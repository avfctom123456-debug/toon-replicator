-- Create player_stats table for leaderboard with ELO
CREATE TABLE public.player_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  pvp_wins INTEGER NOT NULL DEFAULT 0,
  pvp_losses INTEGER NOT NULL DEFAULT 0,
  pvp_draws INTEGER NOT NULL DEFAULT 0,
  cpu_wins INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  last_match_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view player stats"
ON public.player_stats
FOR SELECT
USING (true);

CREATE POLICY "Users can insert own stats"
ON public.player_stats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
ON public.player_stats
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_player_stats_updated_at
BEFORE UPDATE ON public.player_stats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate ELO change
CREATE OR REPLACE FUNCTION public.calculate_elo_change(
  winner_elo INTEGER,
  loser_elo INTEGER,
  k_factor INTEGER DEFAULT 32
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_score FLOAT;
  elo_change INTEGER;
BEGIN
  -- Calculate expected score for winner
  expected_score := 1.0 / (1.0 + power(10, (loser_elo - winner_elo)::FLOAT / 400.0));
  -- Calculate ELO change (winner gets positive, loser gets negative)
  elo_change := round(k_factor * (1 - expected_score));
  RETURN elo_change;
END;
$$;

-- Create function to update stats after a PVP match
CREATE OR REPLACE FUNCTION public.update_pvp_stats(
  p_winner_id UUID,
  p_loser_id UUID,
  p_is_draw BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  winner_elo INTEGER;
  loser_elo INTEGER;
  elo_change INTEGER;
BEGIN
  -- Ensure both players have stats records
  INSERT INTO public.player_stats (user_id)
  VALUES (p_winner_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.player_stats (user_id)
  VALUES (p_loser_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  IF p_is_draw THEN
    -- Update draw counts for both
    UPDATE public.player_stats
    SET pvp_draws = pvp_draws + 1,
        win_streak = 0,
        last_match_at = now()
    WHERE user_id IN (p_winner_id, p_loser_id);
  ELSE
    -- Get current ELO ratings
    SELECT elo_rating INTO winner_elo FROM public.player_stats WHERE user_id = p_winner_id;
    SELECT elo_rating INTO loser_elo FROM public.player_stats WHERE user_id = p_loser_id;
    
    -- Calculate ELO change
    elo_change := public.calculate_elo_change(winner_elo, loser_elo);
    
    -- Update winner stats
    UPDATE public.player_stats
    SET pvp_wins = pvp_wins + 1,
        elo_rating = elo_rating + elo_change,
        win_streak = win_streak + 1,
        best_win_streak = GREATEST(best_win_streak, win_streak + 1),
        last_match_at = now()
    WHERE user_id = p_winner_id;
    
    -- Update loser stats
    UPDATE public.player_stats
    SET pvp_losses = pvp_losses + 1,
        elo_rating = GREATEST(100, elo_rating - elo_change),
        win_streak = 0,
        last_match_at = now()
    WHERE user_id = p_loser_id;
  END IF;
END;
$$;

-- Create function to update CPU win stats
CREATE OR REPLACE FUNCTION public.update_cpu_win(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_stats (user_id, cpu_wins)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET cpu_wins = player_stats.cpu_wins + 1, updated_at = now();
END;
$$;