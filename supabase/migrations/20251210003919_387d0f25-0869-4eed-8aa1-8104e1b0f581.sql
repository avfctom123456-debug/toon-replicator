-- Add daily_coins_earned and last_coin_reset to player_stats
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS daily_coins_earned integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_coin_reset date NOT NULL DEFAULT CURRENT_DATE;

-- Update PVP stats function with 200 win / 100 loss rewards and 2k daily cap
CREATE OR REPLACE FUNCTION public.update_pvp_stats(p_winner_id uuid, p_loser_id uuid, p_is_draw boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  winner_elo INTEGER;
  loser_elo INTEGER;
  elo_change INTEGER;
  v_winner_daily_earned INTEGER;
  v_loser_daily_earned INTEGER;
  v_winner_last_reset DATE;
  v_loser_last_reset DATE;
  v_winner_reward INTEGER := 0;
  v_loser_reward INTEGER := 0;
  v_daily_cap INTEGER := 2000;
BEGIN
  -- Ensure both players have stats records
  INSERT INTO public.player_stats (user_id)
  VALUES (p_winner_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO public.player_stats (user_id)
  VALUES (p_loser_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get current daily earnings and check for reset
  SELECT daily_coins_earned, last_coin_reset INTO v_winner_daily_earned, v_winner_last_reset 
  FROM public.player_stats WHERE user_id = p_winner_id;
  
  SELECT daily_coins_earned, last_coin_reset INTO v_loser_daily_earned, v_loser_last_reset 
  FROM public.player_stats WHERE user_id = p_loser_id;
  
  -- Reset daily earnings if new day
  IF v_winner_last_reset < CURRENT_DATE THEN
    v_winner_daily_earned := 0;
  END IF;
  IF v_loser_last_reset < CURRENT_DATE THEN
    v_loser_daily_earned := 0;
  END IF;
  
  IF p_is_draw THEN
    -- Update draw counts for both (no coin rewards for draws)
    UPDATE public.player_stats
    SET pvp_draws = pvp_draws + 1,
        win_streak = 0,
        last_match_at = now(),
        last_coin_reset = CURRENT_DATE,
        daily_coins_earned = CASE WHEN last_coin_reset < CURRENT_DATE THEN 0 ELSE daily_coins_earned END
    WHERE user_id IN (p_winner_id, p_loser_id);
  ELSE
    -- Get current ELO ratings
    SELECT elo_rating INTO winner_elo FROM public.player_stats WHERE user_id = p_winner_id;
    SELECT elo_rating INTO loser_elo FROM public.player_stats WHERE user_id = p_loser_id;
    
    -- Calculate ELO change
    elo_change := public.calculate_elo_change(winner_elo, loser_elo);
    
    -- Calculate rewards with daily cap
    v_winner_reward := LEAST(200, v_daily_cap - v_winner_daily_earned);
    v_winner_reward := GREATEST(0, v_winner_reward);
    
    v_loser_reward := LEAST(100, v_daily_cap - v_loser_daily_earned);
    v_loser_reward := GREATEST(0, v_loser_reward);
    
    -- Update winner stats
    UPDATE public.player_stats
    SET pvp_wins = pvp_wins + 1,
        elo_rating = elo_rating + elo_change,
        win_streak = win_streak + 1,
        best_win_streak = GREATEST(best_win_streak, win_streak + 1),
        last_match_at = now(),
        daily_coins_earned = CASE WHEN last_coin_reset < CURRENT_DATE THEN v_winner_reward ELSE daily_coins_earned + v_winner_reward END,
        last_coin_reset = CURRENT_DATE
    WHERE user_id = p_winner_id;
    
    -- Update loser stats
    UPDATE public.player_stats
    SET pvp_losses = pvp_losses + 1,
        elo_rating = GREATEST(100, elo_rating - elo_change),
        win_streak = 0,
        last_match_at = now(),
        daily_coins_earned = CASE WHEN last_coin_reset < CURRENT_DATE THEN v_loser_reward ELSE daily_coins_earned + v_loser_reward END,
        last_coin_reset = CURRENT_DATE
    WHERE user_id = p_loser_id;
    
    -- Award coins to winner
    IF v_winner_reward > 0 THEN
      UPDATE public.profiles SET coins = coins + v_winner_reward WHERE user_id = p_winner_id;
    END IF;
    
    -- Award coins to loser
    IF v_loser_reward > 0 THEN
      UPDATE public.profiles SET coins = coins + v_loser_reward WHERE user_id = p_loser_id;
    END IF;
  END IF;
END;
$function$;