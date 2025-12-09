-- Create seasons table
CREATE TABLE public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  season_number INTEGER NOT NULL UNIQUE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Anyone can view seasons
CREATE POLICY "Anyone can view seasons"
ON public.seasons
FOR SELECT
USING (true);

-- Only admins can manage seasons
CREATE POLICY "Admins can insert seasons"
ON public.seasons
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seasons"
ON public.seasons
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create season_player_stats to archive stats at end of season
CREATE TABLE public.season_player_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  final_rank INTEGER NOT NULL,
  final_elo INTEGER NOT NULL,
  pvp_wins INTEGER NOT NULL DEFAULT 0,
  pvp_losses INTEGER NOT NULL DEFAULT 0,
  pvp_draws INTEGER NOT NULL DEFAULT 0,
  reward_tier TEXT NOT NULL,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(season_id, user_id)
);

-- Enable RLS
ALTER TABLE public.season_player_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can view season stats
CREATE POLICY "Anyone can view season stats"
ON public.season_player_stats
FOR SELECT
USING (true);

-- Create reward tiers type
CREATE TYPE public.reward_tier AS ENUM ('champion', 'diamond', 'gold', 'silver', 'bronze', 'participant');

-- Function to get reward tier and coins based on rank
CREATE OR REPLACE FUNCTION public.get_reward_for_rank(p_rank INTEGER)
RETURNS TABLE(tier TEXT, coins INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_rank = 1 THEN
    RETURN QUERY SELECT 'champion'::TEXT, 500;
  ELSIF p_rank <= 5 THEN
    RETURN QUERY SELECT 'diamond'::TEXT, 300;
  ELSIF p_rank <= 20 THEN
    RETURN QUERY SELECT 'gold'::TEXT, 150;
  ELSIF p_rank <= 50 THEN
    RETURN QUERY SELECT 'silver'::TEXT, 75;
  ELSIF p_rank <= 100 THEN
    RETURN QUERY SELECT 'bronze'::TEXT, 25;
  ELSE
    RETURN QUERY SELECT 'participant'::TEXT, 10;
  END IF;
END;
$$;

-- Function to end current season and distribute rewards
CREATE OR REPLACE FUNCTION public.end_season_and_distribute_rewards()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id UUID;
  v_next_season_number INTEGER;
  v_player RECORD;
  v_rank INTEGER := 0;
  v_reward RECORD;
BEGIN
  -- Get current active season
  SELECT id INTO v_season_id FROM public.seasons WHERE is_active = true LIMIT 1;
  
  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;
  
  -- Archive all player stats with rankings
  FOR v_player IN (
    SELECT user_id, elo_rating, pvp_wins, pvp_losses, pvp_draws
    FROM public.player_stats
    WHERE pvp_wins + pvp_losses + pvp_draws > 0
    ORDER BY elo_rating DESC
  ) LOOP
    v_rank := v_rank + 1;
    
    -- Get reward for this rank
    SELECT tier, coins INTO v_reward FROM public.get_reward_for_rank(v_rank);
    
    -- Insert archived stats
    INSERT INTO public.season_player_stats (
      season_id, user_id, final_rank, final_elo, pvp_wins, pvp_losses, pvp_draws, reward_tier, reward_coins
    ) VALUES (
      v_season_id, v_player.user_id, v_rank, v_player.elo_rating, 
      v_player.pvp_wins, v_player.pvp_losses, v_player.pvp_draws,
      v_reward.tier, v_reward.coins
    );
    
    -- Award coins to player
    UPDATE public.profiles
    SET coins = coins + v_reward.coins
    WHERE user_id = v_player.user_id;
  END LOOP;
  
  -- End current season
  UPDATE public.seasons
  SET is_active = false, end_date = now()
  WHERE id = v_season_id;
  
  -- Reset all player stats for new season
  UPDATE public.player_stats
  SET elo_rating = 1000,
      pvp_wins = 0,
      pvp_losses = 0,
      pvp_draws = 0,
      win_streak = 0,
      updated_at = now();
  
  -- Create new season
  SELECT COALESCE(MAX(season_number), 0) + 1 INTO v_next_season_number FROM public.seasons;
  
  INSERT INTO public.seasons (name, season_number, is_active)
  VALUES ('Season ' || v_next_season_number, v_next_season_number, true);
  
  RETURN v_season_id;
END;
$$;

-- Create initial season
INSERT INTO public.seasons (name, season_number, is_active)
VALUES ('Season 1', 1, true);