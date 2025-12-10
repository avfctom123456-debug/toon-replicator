
-- Function to increment packs opened for a user
CREATE OR REPLACE FUNCTION public.increment_packs_opened(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.player_stats (user_id, packs_opened)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET packs_opened = player_stats.packs_opened + 1, updated_at = now();
END;
$$;

-- Function to update highest score for a user
CREATE OR REPLACE FUNCTION public.update_highest_score(p_user_id uuid, p_score integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.player_stats 
  SET highest_score = GREATEST(highest_score, p_score), updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.player_stats (user_id, highest_score)
    VALUES (p_user_id, p_score);
  END IF;
END;
$$;

-- Function to increment color wins for a user
CREATE OR REPLACE FUNCTION public.increment_color_wins(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.player_stats 
  SET color_wins = color_wins + 1, updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.player_stats (user_id, color_wins)
    VALUES (p_user_id, 1);
  END IF;
END;
$$;

-- Function to increment perfect wins for a user
CREATE OR REPLACE FUNCTION public.increment_perfect_wins(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.player_stats 
  SET perfect_wins = perfect_wins + 1, updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.player_stats (user_id, perfect_wins)
    VALUES (p_user_id, 1);
  END IF;
END;
$$;

-- Function to track coins earned (for economy achievements)
CREATE OR REPLACE FUNCTION public.add_coins_earned(p_user_id uuid, p_coins integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.player_stats 
  SET total_coins_earned = total_coins_earned + p_coins, updated_at = now()
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.player_stats (user_id, total_coins_earned)
    VALUES (p_user_id, p_coins);
  END IF;
END;
$$;
