
-- Add tracking columns to player_stats
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS packs_opened integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_coins_earned integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS highest_score integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS color_wins integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS perfect_wins integer NOT NULL DEFAULT 0;

-- Function to update achievement progress for a user
CREATE OR REPLACE FUNCTION public.update_achievement_progress(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_achievement RECORD;
  v_current_value integer;
  v_stats RECORD;
  v_cards_owned integer;
  v_unique_cards integer;
  v_trades_completed integer;
  v_auctions_won integer;
  v_auctions_created integer;
  v_wishlist_count integer;
BEGIN
  -- Get player stats
  SELECT * INTO v_stats FROM public.player_stats WHERE user_id = p_user_id;
  
  -- If no stats exist, create them
  IF v_stats IS NULL THEN
    INSERT INTO public.player_stats (user_id) VALUES (p_user_id);
    SELECT * INTO v_stats FROM public.player_stats WHERE user_id = p_user_id;
  END IF;
  
  -- Get collection stats
  SELECT COALESCE(SUM(quantity), 0), COUNT(DISTINCT card_id) 
  INTO v_cards_owned, v_unique_cards
  FROM public.user_cards WHERE user_id = p_user_id;
  
  -- Get trading stats
  SELECT COUNT(*) INTO v_trades_completed
  FROM public.trades 
  WHERE (user_id = p_user_id OR completed_by = p_user_id) AND status = 'completed';
  
  -- Get auction stats
  SELECT COUNT(*) INTO v_auctions_won
  FROM public.auctions 
  WHERE highest_bidder_id = p_user_id AND status = 'completed';
  
  SELECT COUNT(*) INTO v_auctions_created
  FROM public.auctions WHERE user_id = p_user_id;
  
  -- Get wishlist count
  SELECT COUNT(*) INTO v_wishlist_count
  FROM public.wishlists WHERE user_id = p_user_id;
  
  -- Loop through all active achievements
  FOR v_achievement IN 
    SELECT * FROM public.achievements WHERE is_active = true
  LOOP
    -- Determine current value based on requirement_type
    v_current_value := CASE v_achievement.requirement_type
      -- Game achievements
      WHEN 'pvp_wins' THEN v_stats.pvp_wins
      WHEN 'cpu_wins' THEN v_stats.cpu_wins
      WHEN 'total_wins' THEN v_stats.pvp_wins + v_stats.cpu_wins
      WHEN 'total_matches' THEN v_stats.pvp_wins + v_stats.pvp_losses + v_stats.pvp_draws + v_stats.cpu_wins
      WHEN 'win_streak' THEN v_stats.best_win_streak
      WHEN 'elo_rating' THEN v_stats.elo_rating
      WHEN 'highest_score' THEN v_stats.highest_score
      WHEN 'color_wins' THEN v_stats.color_wins
      WHEN 'perfect_wins' THEN v_stats.perfect_wins
      -- Collection achievements
      WHEN 'cards_owned' THEN v_cards_owned
      WHEN 'unique_cards' THEN v_unique_cards
      WHEN 'wishlist_cards' THEN v_wishlist_count
      -- Trading achievements
      WHEN 'trades_completed' THEN v_trades_completed
      WHEN 'auctions_won' THEN v_auctions_won
      WHEN 'auctions_created' THEN v_auctions_created
      -- Economy achievements
      WHEN 'packs_opened' THEN v_stats.packs_opened
      WHEN 'coins_earned' THEN v_stats.total_coins_earned
      ELSE 0
    END;
    
    -- Insert or update user achievement progress
    INSERT INTO public.user_achievements (user_id, achievement_id, progress, completed, completed_at)
    VALUES (
      p_user_id, 
      v_achievement.id, 
      LEAST(v_current_value, v_achievement.requirement_value),
      v_current_value >= v_achievement.requirement_value,
      CASE WHEN v_current_value >= v_achievement.requirement_value THEN now() ELSE NULL END
    )
    ON CONFLICT (user_id, achievement_id) 
    DO UPDATE SET 
      progress = LEAST(v_current_value, v_achievement.requirement_value),
      completed = v_current_value >= v_achievement.requirement_value,
      completed_at = CASE 
        WHEN v_current_value >= v_achievement.requirement_value AND user_achievements.completed_at IS NULL 
        THEN now() 
        ELSE user_achievements.completed_at 
      END,
      updated_at = now();
  END LOOP;
END;
$$;

-- Add unique constraint for user_achievements
ALTER TABLE public.user_achievements 
DROP CONSTRAINT IF EXISTS user_achievements_user_achievement_unique;

ALTER TABLE public.user_achievements 
ADD CONSTRAINT user_achievements_user_achievement_unique 
UNIQUE (user_id, achievement_id);

-- Trigger function for player_stats changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.update_achievement_progress(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Trigger function for user_cards changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_achievement_progress(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.update_achievement_progress(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger function for trades changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_trades()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    PERFORM public.update_achievement_progress(NEW.user_id);
    IF NEW.completed_by IS NOT NULL THEN
      PERFORM public.update_achievement_progress(NEW.completed_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for auctions changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_auctions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update for auction creator
  PERFORM public.update_achievement_progress(NEW.user_id);
  -- Update for winner if auction completed
  IF NEW.status = 'completed' AND NEW.highest_bidder_id IS NOT NULL THEN
    PERFORM public.update_achievement_progress(NEW.highest_bidder_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for wishlist changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_wishlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_achievement_progress(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.update_achievement_progress(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS update_achievements_on_stats ON public.player_stats;
CREATE TRIGGER update_achievements_on_stats
  AFTER INSERT OR UPDATE ON public.player_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_stats();

DROP TRIGGER IF EXISTS update_achievements_on_cards ON public.user_cards;
CREATE TRIGGER update_achievements_on_cards
  AFTER INSERT OR UPDATE OR DELETE ON public.user_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_cards();

DROP TRIGGER IF EXISTS update_achievements_on_trades ON public.trades;
CREATE TRIGGER update_achievements_on_trades
  AFTER INSERT OR UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_trades();

DROP TRIGGER IF EXISTS update_achievements_on_auctions ON public.auctions;
CREATE TRIGGER update_achievements_on_auctions
  AFTER INSERT OR UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_auctions();

DROP TRIGGER IF EXISTS update_achievements_on_wishlist ON public.wishlists;
CREATE TRIGGER update_achievements_on_wishlist
  AFTER INSERT OR UPDATE OR DELETE ON public.wishlists
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_wishlist();
