-- Create achievements table for admin-defined achievements
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL, -- 'game', 'collection', 'trading', 'economy'
  requirement_type text NOT NULL, -- 'pvp_wins', 'cpu_wins', 'cards_owned', 'trades_completed', etc.
  requirement_value integer NOT NULL, -- e.g., 10 wins, 50 cards
  coin_reward integer NOT NULL DEFAULT 0,
  icon text, -- optional icon identifier
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create user_achievements table to track user progress
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements policies
CREATE POLICY "Anyone can view active achievements"
ON public.achievements
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage achievements"
ON public.achievements
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- User achievements policies
CREATE POLICY "Users can view own achievements"
ON public.user_achievements
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
ON public.user_achievements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
ON public.user_achievements
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to claim achievement reward
CREATE OR REPLACE FUNCTION public.claim_achievement_reward(p_achievement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_user_achievement RECORD;
  v_achievement RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user achievement
  SELECT * INTO v_user_achievement 
  FROM public.user_achievements 
  WHERE user_id = v_user_id AND achievement_id = p_achievement_id
  FOR UPDATE;
  
  IF v_user_achievement IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Achievement not found');
  END IF;
  
  IF NOT v_user_achievement.completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Achievement not completed');
  END IF;
  
  IF v_user_achievement.reward_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;
  
  -- Get achievement details
  SELECT * INTO v_achievement FROM public.achievements WHERE id = p_achievement_id;
  
  -- Award coins
  UPDATE public.profiles SET coins = coins + v_achievement.coin_reward WHERE user_id = v_user_id;
  
  -- Mark as claimed
  UPDATE public.user_achievements 
  SET reward_claimed = true, updated_at = now()
  WHERE id = v_user_achievement.id;
  
  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_user_id,
    'achievement_reward',
    'Achievement Reward Claimed!',
    'You received ' || v_achievement.coin_reward || ' coins for completing "' || v_achievement.name || '"',
    jsonb_build_object('achievement_id', p_achievement_id, 'coins', v_achievement.coin_reward)
  );
  
  RETURN jsonb_build_object('success', true, 'coins', v_achievement.coin_reward);
END;
$$;

-- Insert default achievements
INSERT INTO public.achievements (name, description, category, requirement_type, requirement_value, coin_reward, icon) VALUES
-- Game achievements
('First Victory', 'Win your first game against the computer', 'game', 'cpu_wins', 1, 50, 'trophy'),
('CPU Crusher', 'Win 10 games against the computer', 'game', 'cpu_wins', 10, 100, 'trophy'),
('AI Dominator', 'Win 50 games against the computer', 'game', 'cpu_wins', 50, 500, 'trophy'),
('PVP Beginner', 'Win your first PVP match', 'game', 'pvp_wins', 1, 100, 'swords'),
('PVP Warrior', 'Win 10 PVP matches', 'game', 'pvp_wins', 10, 250, 'swords'),
('PVP Champion', 'Win 50 PVP matches', 'game', 'pvp_wins', 50, 1000, 'crown'),
('Hot Streak', 'Reach a 5 game win streak', 'game', 'best_win_streak', 5, 200, 'flame'),
('Unstoppable', 'Reach a 10 game win streak', 'game', 'best_win_streak', 10, 500, 'flame'),

-- Collection achievements
('Collector', 'Own 10 unique cards', 'collection', 'unique_cards', 10, 100, 'cards'),
('Enthusiast', 'Own 50 unique cards', 'collection', 'unique_cards', 50, 300, 'cards'),
('Completionist', 'Own 100 unique cards', 'collection', 'unique_cards', 100, 750, 'cards'),

-- Trading achievements
('First Trade', 'Complete your first trade', 'trading', 'trades_completed', 1, 50, 'handshake'),
('Active Trader', 'Complete 10 trades', 'trading', 'trades_completed', 10, 200, 'handshake'),
('Auction Winner', 'Win your first auction', 'trading', 'auctions_won', 1, 100, 'gavel'),
('Auction Master', 'Win 10 auctions', 'trading', 'auctions_won', 10, 400, 'gavel'),

-- Economy achievements
('Savings', 'Accumulate 1,000 coins', 'economy', 'total_coins_earned', 1000, 100, 'coins'),
('Wealthy', 'Accumulate 10,000 coins', 'economy', 'total_coins_earned', 10000, 500, 'coins'),
('Rich', 'Accumulate 50,000 coins', 'economy', 'total_coins_earned', 50000, 2000, 'coins');

-- Create updated_at trigger
CREATE TRIGGER update_achievements_updated_at
BEFORE UPDATE ON public.achievements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_achievements_updated_at
BEFORE UPDATE ON public.user_achievements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();