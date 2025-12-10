-- Update the achievement progress function to support wins_with_card
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
  v_card_wins_total integer;
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
  
  -- Count Slam rarity cards owned
  SELECT COUNT(DISTINCT card_id) INTO v_slam_count
  FROM public.user_cards 
  WHERE user_id = p_user_id 
  AND card_id IN (82, 171, 175, 229, 238, 249, 302, 323, 354, 404, 438, 455);
  
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
      -- Wins with card - handled separately
      WHEN 'wins_with_card' THEN NULL
      ELSE 0
    END;
    
    -- Special handling for wins_with_card - check card_wins table
    IF v_achievement.requirement_type = 'wins_with_card' THEN
      -- The achievement icon field stores the card_id(s) for this achievement
      -- Format: single card_id or comma-separated list like "123,456,789"
      IF v_achievement.icon IS NOT NULL THEN
        SELECT COALESCE(SUM(wins), 0) INTO v_current_value
        FROM public.card_wins
        WHERE user_id = p_user_id
        AND card_id = ANY(
          SELECT unnest(string_to_array(v_achievement.icon, ','))::integer
        );
      ELSE
        -- If no specific card, count total card wins
        SELECT COALESCE(SUM(wins), 0) INTO v_current_value
        FROM public.card_wins
        WHERE user_id = p_user_id;
      END IF;
    END IF;
    
    -- Skip if value is null
    IF v_current_value IS NULL THEN
      v_current_value := 0;
    END IF;
    
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

-- Add trigger to update achievements when card_wins changes
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_card_wins()
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

-- Create trigger on card_wins table
DROP TRIGGER IF EXISTS trigger_card_wins_achievements ON public.card_wins;
CREATE TRIGGER trigger_card_wins_achievements
  AFTER INSERT OR UPDATE ON public.card_wins
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_achievements_on_card_wins();

-- Update existing Doofenshmirtz achievement with card_id in icon field
-- Doofenshmirtz card ID is 108
UPDATE public.achievements 
SET icon = '108'
WHERE name = 'Doofenshmirtz Evil Incorporated' AND requirement_type = 'wins_with_card';

-- Insert more character-themed achievements
-- Using icon field to store card_id(s) for the character
INSERT INTO public.achievements (name, description, requirement_type, requirement_value, coin_reward, category, icon, is_active)
VALUES
  -- SpongeBob characters (card IDs: 340-SpongeBob, 282-Patrick, 326-Squidward)
  ('Bikini Bottom Champion', 'Win 10 games with SpongeBob cards in your deck', 'wins_with_card', 10, 150, 'character', '340,282,326,260,217,136,294', true),
  
  -- Dragon Ball Z characters (card IDs: 455-Super Saiyan Goku, 420-Goku, 475-Vegeta)
  ('Super Saiyan Master', 'Win 25 games with Dragon Ball Z cards in your deck', 'wins_with_card', 25, 300, 'character', '455,420,475,414,478,442', true),
  
  -- Frozen characters (card IDs: 438-Elsa, 410-Anna, 468-Olaf)
  ('Let It Go', 'Win 15 games with Frozen cards in your deck', 'wins_with_card', 15, 200, 'character', '438,410,468,454', true),
  
  -- Shrek characters (card IDs: 396-Shrek, 399-Donkey, 403-Fiona)
  ('Ogre Overlord', 'Win 20 games with Shrek cards in your deck', 'wins_with_card', 20, 250, 'character', '396,399,403,393,408', true),
  
  -- Clone Wars characters
  ('Republic Commander', 'Win 15 games with Clone Wars cards in your deck', 'wins_with_card', 15, 200, 'character', '404,415,430,445,460', true),
  
  -- Avatar characters
  ('The Last Airbender', 'Win 20 games with Avatar cards in your deck', 'wins_with_card', 20, 250, 'character', '487,490,493,496,499,502,505', true),
  
  -- Teen Titans characters (original series)
  ('Teen Titans Go!', 'Win 15 games with Teen Titans cards in your deck', 'wins_with_card', 15, 200, 'character', '38,106,308,329,352', true),
  
  -- Powerpuff Girls
  ('Saving the World', 'Win 10 games with Powerpuff Girls cards in your deck', 'wins_with_card', 10, 150, 'character', '47,48,63', true),
  
  -- Looney Tunes
  ('Thats All Folks', 'Win 20 games with Looney Tunes cards in your deck', 'wins_with_card', 20, 250, 'character', '67,88,99,366,392', true),
  
  -- Justice League
  ('Justice Prevails', 'Win 25 games with Justice League cards in your deck', 'wins_with_card', 25, 300, 'character', '28,356,382,162,253', true)
  
ON CONFLICT DO NOTHING;