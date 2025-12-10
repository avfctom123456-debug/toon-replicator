
-- Add new tracking columns to player_stats for card-specific achievements
ALTER TABLE public.player_stats 
ADD COLUMN IF NOT EXISTS total_card_plays integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_card_buffs integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_card_cancels integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_adjacency_plays integer NOT NULL DEFAULT 0;

-- Update the achievement progress function to handle specific card achievements
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
  v_copy_one_count integer;
  v_low_copy_count integer;
  v_slam_count integer;
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
  
  -- Count #1 copy cards owned
  SELECT COUNT(*) INTO v_copy_one_count
  FROM public.user_cards 
  WHERE user_id = p_user_id AND copy_number = 1;
  
  -- Count low copy number cards (copy_number <= 10)
  SELECT COUNT(*) INTO v_low_copy_count
  FROM public.user_cards 
  WHERE user_id = p_user_id AND copy_number <= 10;
  
  -- Count Slam rarity cards owned (specific card IDs for Slam cards)
  -- Slam cards: Coop, Harmony Bunny, Headmistress, Liberty Belle, Mad Mod, Mange, Raj, Sam, Super Monkey, Darth Anakin, Elsa, Super Saiyan Goku
  SELECT COUNT(DISTINCT card_id) INTO v_slam_count
  FROM public.user_cards 
  WHERE user_id = p_user_id 
  AND card_id IN (
    -- These are placeholder IDs - the actual Slam card IDs from cards.json
    -- Original series Slam cards (approximate IDs based on character names)
    62, 145, 146, 186, 203, 206, 270, 290, 340,
    -- Series 2 Slam cards
    420, 478, 520
  );
  
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
      -- In-game card stats
      WHEN 'card_plays' THEN v_stats.total_card_plays
      WHEN 'card_buffs' THEN v_stats.total_card_buffs
      WHEN 'card_cancels' THEN v_stats.total_card_cancels
      WHEN 'card_adjacency' THEN v_stats.total_adjacency_plays
      WHEN 'wins_with_card' THEN 0 -- This would need special tracking per card
      -- Collection achievements
      WHEN 'cards_owned' THEN v_cards_owned
      WHEN 'unique_cards' THEN v_unique_cards
      WHEN 'wishlist_cards' THEN v_wishlist_count
      WHEN 'copy_number_one' THEN v_copy_one_count
      WHEN 'low_copy_cards' THEN v_low_copy_count
      WHEN 'slam_cards' THEN v_slam_count
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
