-- Create promo codes table
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('card', 'coins')),
  reward_value INTEGER NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create redemptions table to track who redeemed what
CREATE TABLE public.promo_code_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Promo codes policies
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active promo codes"
ON public.promo_codes
FOR SELECT
USING (is_active = true);

-- Redemptions policies
CREATE POLICY "Users can view own redemptions"
ON public.promo_code_redemptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can redeem codes"
ON public.promo_code_redemptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to redeem a promo code
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_user_id UUID;
  v_already_redeemed BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get promo code
  SELECT * INTO v_promo FROM public.promo_codes 
  WHERE UPPER(code) = UPPER(p_code) AND is_active = true
  FOR UPDATE;
  
  IF v_promo IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive code');
  END IF;
  
  -- Check expiration
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has expired');
  END IF;
  
  -- Check max uses
  IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has reached its maximum uses');
  END IF;
  
  -- Check if user already redeemed
  SELECT EXISTS (
    SELECT 1 FROM public.promo_code_redemptions 
    WHERE promo_code_id = v_promo.id AND user_id = v_user_id
  ) INTO v_already_redeemed;
  
  IF v_already_redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;
  
  -- Record redemption
  INSERT INTO public.promo_code_redemptions (promo_code_id, user_id)
  VALUES (v_promo.id, v_user_id);
  
  -- Update uses count
  UPDATE public.promo_codes SET current_uses = current_uses + 1 WHERE id = v_promo.id;
  
  -- Give reward
  IF v_promo.reward_type = 'coins' THEN
    UPDATE public.profiles SET coins = coins + v_promo.reward_value WHERE user_id = v_user_id;
  ELSIF v_promo.reward_type = 'card' THEN
    -- Check if user already has card
    IF EXISTS (SELECT 1 FROM public.user_cards WHERE user_id = v_user_id AND card_id = v_promo.reward_value) THEN
      UPDATE public.user_cards SET quantity = quantity + 1 
      WHERE user_id = v_user_id AND card_id = v_promo.reward_value;
    ELSE
      INSERT INTO public.user_cards (user_id, card_id, quantity)
      VALUES (v_user_id, v_promo.reward_value, 1);
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'reward_type', v_promo.reward_type, 
    'reward_value', v_promo.reward_value
  );
END;
$$;