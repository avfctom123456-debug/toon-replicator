-- Daily login reward tiers (admin configurable)
CREATE TABLE public.daily_login_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('coins', 'card')),
  reward_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User login streak tracking
CREATE TABLE public.user_login_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_claim_date DATE,
  total_claims INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_login_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_streaks ENABLE ROW LEVEL SECURITY;

-- Policies for daily_login_rewards
CREATE POLICY "Anyone can view rewards"
ON public.daily_login_rewards
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rewards"
ON public.daily_login_rewards
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Policies for user_login_streaks
CREATE POLICY "Users can view own streak"
ON public.user_login_streaks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak"
ON public.user_login_streaks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streak"
ON public.user_login_streaks
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to claim daily reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_streak RECORD;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
  v_reward RECORD;
  v_max_day INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get or create user streak
  SELECT * INTO v_streak FROM public.user_login_streaks WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_streak IS NULL THEN
    -- First time claiming
    INSERT INTO public.user_login_streaks (user_id, current_streak, last_claim_date, total_claims)
    VALUES (v_user_id, 1, v_today, 1)
    RETURNING * INTO v_streak;
    v_new_streak := 1;
  ELSE
    -- Check if already claimed today
    IF v_streak.last_claim_date = v_today THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already claimed today', 'next_claim', v_today + 1);
    END IF;
    
    -- Check if streak continues or resets
    IF v_streak.last_claim_date = v_today - 1 THEN
      v_new_streak := v_streak.current_streak + 1;
    ELSE
      v_new_streak := 1; -- Reset streak
    END IF;
    
    UPDATE public.user_login_streaks
    SET current_streak = v_new_streak,
        last_claim_date = v_today,
        total_claims = total_claims + 1,
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;
  
  -- Get max configured day
  SELECT MAX(day_number) INTO v_max_day FROM public.daily_login_rewards;
  
  IF v_max_day IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No rewards configured');
  END IF;
  
  -- Get reward for this day (cycle if beyond max)
  SELECT * INTO v_reward FROM public.daily_login_rewards 
  WHERE day_number = CASE 
    WHEN v_new_streak > v_max_day THEN ((v_new_streak - 1) % v_max_day) + 1
    ELSE v_new_streak
  END;
  
  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reward for this day');
  END IF;
  
  -- Give reward
  IF v_reward.reward_type = 'coins' THEN
    UPDATE public.profiles SET coins = coins + v_reward.reward_value WHERE user_id = v_user_id;
  ELSIF v_reward.reward_type = 'card' THEN
    IF EXISTS (SELECT 1 FROM public.user_cards WHERE user_id = v_user_id AND card_id = v_reward.reward_value) THEN
      UPDATE public.user_cards SET quantity = quantity + 1 
      WHERE user_id = v_user_id AND card_id = v_reward.reward_value;
    ELSE
      INSERT INTO public.user_cards (user_id, card_id, quantity)
      VALUES (v_user_id, v_reward.reward_value, 1);
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'day', v_new_streak,
    'reward_type', v_reward.reward_type,
    'reward_value', v_reward.reward_value,
    'streak', v_new_streak
  );
END;
$$;

-- Insert default reward tiers
INSERT INTO public.daily_login_rewards (day_number, reward_type, reward_value) VALUES
  (1, 'coins', 50),
  (2, 'coins', 75),
  (3, 'coins', 100),
  (4, 'coins', 150),
  (5, 'coins', 200),
  (6, 'coins', 250),
  (7, 'coins', 500);