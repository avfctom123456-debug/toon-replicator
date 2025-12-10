-- Create tournaments table
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pool INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 8,
  current_participants INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  bracket_type TEXT NOT NULL DEFAULT 'single_elimination',
  current_round INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL,
  winner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tournament participants table
CREATE TABLE public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  deck_card_ids INTEGER[] NOT NULL DEFAULT '{}',
  seed INTEGER,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  eliminated_at TIMESTAMP WITH TIME ZONE,
  placement INTEGER,
  prize_won INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- Create tournament matches table
CREATE TABLE public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID,
  player2_id UUID,
  winner_id UUID,
  player1_score INTEGER DEFAULT 0,
  player2_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'completed')),
  match_id UUID REFERENCES public.matches(id),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

-- Tournaments policies
CREATE POLICY "Anyone can view tournaments" ON public.tournaments
  FOR SELECT USING (true);

CREATE POLICY "Admins can create tournaments" ON public.tournaments
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tournaments" ON public.tournaments
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tournaments" ON public.tournaments
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Participants policies
CREATE POLICY "Anyone can view participants" ON public.tournament_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join tournaments" ON public.tournament_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave tournaments" ON public.tournament_participants
  FOR DELETE USING (auth.uid() = user_id);

-- Matches policies
CREATE POLICY "Anyone can view tournament matches" ON public.tournament_matches
  FOR SELECT USING (true);

CREATE POLICY "System can manage matches" ON public.tournament_matches
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Function to join a tournament
CREATE OR REPLACE FUNCTION public.join_tournament(p_tournament_id UUID, p_deck_card_ids INTEGER[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tournament RECORD;
  v_user_coins INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get tournament
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  
  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  IF v_tournament.status != 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is not open for registration');
  END IF;
  
  IF v_tournament.current_participants >= v_tournament.max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is full');
  END IF;
  
  -- Check if already joined
  IF EXISTS (SELECT 1 FROM public.tournament_participants WHERE tournament_id = p_tournament_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already joined this tournament');
  END IF;
  
  -- Check user has enough coins for entry fee
  SELECT coins INTO v_user_coins FROM public.profiles WHERE user_id = v_user_id;
  
  IF v_user_coins < v_tournament.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins for entry fee');
  END IF;
  
  -- Deduct entry fee
  UPDATE public.profiles SET coins = coins - v_tournament.entry_fee WHERE user_id = v_user_id;
  
  -- Add to prize pool
  UPDATE public.tournaments SET 
    prize_pool = prize_pool + v_tournament.entry_fee,
    current_participants = current_participants + 1
  WHERE id = p_tournament_id;
  
  -- Add participant
  INSERT INTO public.tournament_participants (tournament_id, user_id, deck_card_ids)
  VALUES (p_tournament_id, v_user_id, p_deck_card_ids);
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to leave tournament (only before it starts)
CREATE OR REPLACE FUNCTION public.leave_tournament(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tournament RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;
  
  IF v_tournament.status != 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot leave after tournament starts');
  END IF;
  
  -- Refund entry fee
  UPDATE public.profiles SET coins = coins + v_tournament.entry_fee WHERE user_id = v_user_id;
  
  -- Update tournament
  UPDATE public.tournaments SET 
    prize_pool = prize_pool - v_tournament.entry_fee,
    current_participants = current_participants - 1
  WHERE id = p_tournament_id;
  
  -- Remove participant
  DELETE FROM public.tournament_participants WHERE tournament_id = p_tournament_id AND user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to start tournament and generate bracket
CREATE OR REPLACE FUNCTION public.start_tournament(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament RECORD;
  v_participants UUID[];
  v_num_participants INTEGER;
  v_num_rounds INTEGER;
  v_match_num INTEGER := 1;
  v_i INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;
  
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  
  IF v_tournament.status != 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament already started or completed');
  END IF;
  
  -- Get shuffled participants
  SELECT array_agg(user_id ORDER BY random()) INTO v_participants
  FROM public.tournament_participants WHERE tournament_id = p_tournament_id;
  
  v_num_participants := array_length(v_participants, 1);
  
  IF v_num_participants < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Need at least 2 participants');
  END IF;
  
  -- Calculate rounds needed
  v_num_rounds := ceil(log(2, v_num_participants::numeric))::INTEGER;
  
  -- Assign seeds
  FOR v_i IN 1..v_num_participants LOOP
    UPDATE public.tournament_participants 
    SET seed = v_i 
    WHERE tournament_id = p_tournament_id AND user_id = v_participants[v_i];
  END LOOP;
  
  -- Create first round matches
  FOR v_i IN 1..ceil(v_num_participants::numeric / 2) LOOP
    INSERT INTO public.tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    VALUES (
      p_tournament_id,
      1,
      v_match_num,
      v_participants[(v_i - 1) * 2 + 1],
      CASE WHEN (v_i - 1) * 2 + 2 <= v_num_participants THEN v_participants[(v_i - 1) * 2 + 2] ELSE NULL END,
      CASE WHEN (v_i - 1) * 2 + 2 <= v_num_participants THEN 'ready' ELSE 'completed' END
    );
    v_match_num := v_match_num + 1;
  END LOOP;
  
  -- Handle byes (auto-advance players with no opponent)
  UPDATE public.tournament_matches 
  SET winner_id = player1_id, completed_at = now()
  WHERE tournament_id = p_tournament_id AND round = 1 AND player2_id IS NULL;
  
  -- Update tournament status
  UPDATE public.tournaments SET status = 'active', current_round = 1 WHERE id = p_tournament_id;
  
  RETURN jsonb_build_object('success', true, 'rounds', v_num_rounds);
END;
$$;

-- Trigger to update timestamps
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();