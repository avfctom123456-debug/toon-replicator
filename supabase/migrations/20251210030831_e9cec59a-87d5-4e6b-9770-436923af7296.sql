-- Create table to track wins with specific cards
CREATE TABLE public.card_wins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- Enable RLS
ALTER TABLE public.card_wins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own card wins" ON public.card_wins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own card wins" ON public.card_wins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own card wins" ON public.card_wins
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_card_wins_updated_at
  BEFORE UPDATE ON public.card_wins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment card wins
CREATE OR REPLACE FUNCTION public.increment_card_wins(p_user_id UUID, p_card_ids INTEGER[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card_id INTEGER;
BEGIN
  FOREACH v_card_id IN ARRAY p_card_ids LOOP
    INSERT INTO public.card_wins (user_id, card_id, wins)
    VALUES (p_user_id, v_card_id, 1)
    ON CONFLICT (user_id, card_id)
    DO UPDATE SET wins = card_wins.wins + 1, updated_at = now();
  END LOOP;
END;
$$;