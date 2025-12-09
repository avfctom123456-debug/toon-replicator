-- Create matches table for PVP games
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id uuid NOT NULL,
  player2_id uuid NOT NULL,
  player1_deck int[] NOT NULL DEFAULT '{}',
  player2_deck int[] NOT NULL DEFAULT '{}',
  game_state jsonb NOT NULL DEFAULT '{}',
  current_turn uuid NULL,
  phase text NOT NULL DEFAULT 'waiting',
  winner_id uuid NULL,
  win_method text NULL,
  player1_ready boolean NOT NULL DEFAULT false,
  player2_ready boolean NOT NULL DEFAULT false,
  player1_last_seen timestamp with time zone NOT NULL DEFAULT now(),
  player2_last_seen timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create matchmaking queue table
CREATE TABLE public.matchmaking_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  deck_card_ids int[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Matches policies: players can view and update their own matches
CREATE POLICY "Players can view their matches"
ON public.matches
FOR SELECT
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can update their matches"
ON public.matches
FOR UPDATE
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Matchmaking queue policies
CREATE POLICY "Users can view queue"
ON public.matchmaking_queue
FOR SELECT
USING (true);

CREATE POLICY "Users can insert self into queue"
ON public.matchmaking_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete self from queue"
ON public.matchmaking_queue
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;

-- Create updated_at trigger for matches
CREATE TRIGGER update_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();