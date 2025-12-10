-- Create wishlist table
CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_id)
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own wishlist"
ON public.wishlists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to wishlist"
ON public.wishlists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from wishlist"
ON public.wishlists FOR DELETE
USING (auth.uid() = user_id);

-- Function to notify wishlist users when a trade is created
CREATE OR REPLACE FUNCTION public.notify_wishlist_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id INTEGER;
  v_wishlist_user RECORD;
BEGIN
  -- Check each offered card in the trade
  FOR v_card_id IN SELECT unnest(NEW.offer_card_ids) LOOP
    -- Find users who have this card wishlisted (excluding trade creator)
    FOR v_wishlist_user IN 
      SELECT w.user_id FROM public.wishlists w 
      WHERE w.card_id = v_card_id AND w.user_id != NEW.user_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        v_wishlist_user.user_id,
        'wishlist_trade',
        'Wishlisted Card Available!',
        'A card on your wishlist is now available in a trade',
        jsonb_build_object('trade_id', NEW.id, 'card_id', v_card_id)
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Function to notify wishlist users when an auction is created
CREATE OR REPLACE FUNCTION public.notify_wishlist_auction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wishlist_user RECORD;
BEGIN
  -- Find users who have this card wishlisted (excluding auction creator)
  FOR v_wishlist_user IN 
    SELECT w.user_id FROM public.wishlists w 
    WHERE w.card_id = NEW.card_id AND w.user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_wishlist_user.user_id,
      'wishlist_auction',
      'Wishlisted Card on Auction!',
      'A card on your wishlist is now up for auction',
      jsonb_build_object('auction_id', NEW.id, 'card_id', NEW.card_id)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_trade_created_notify_wishlist
AFTER INSERT ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.notify_wishlist_trade();

CREATE TRIGGER on_auction_created_notify_wishlist
AFTER INSERT ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.notify_wishlist_auction();