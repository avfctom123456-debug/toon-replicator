-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- System can insert notifications (via trigger/function)
CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Create function to notify when outbid
CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_previous_bidder_id UUID;
  v_card_title TEXT;
  v_new_bidder_username TEXT;
BEGIN
  -- Get auction details
  SELECT * INTO v_auction FROM public.auctions WHERE id = NEW.auction_id;
  
  -- Get previous highest bidder (before this bid)
  v_previous_bidder_id := v_auction.highest_bidder_id;
  
  -- If there was a previous bidder and it's not the same person
  IF v_previous_bidder_id IS NOT NULL AND v_previous_bidder_id != NEW.user_id THEN
    -- Get card title from cards.json (we'll use card_id for now)
    v_card_title := 'Card #' || v_auction.card_id;
    
    -- Get new bidder username
    SELECT username INTO v_new_bidder_username 
    FROM public.profiles 
    WHERE user_id = NEW.user_id;
    
    -- Create notification for the outbid user
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      v_previous_bidder_id,
      'outbid',
      'You''ve been outbid!',
      'Someone bid ' || NEW.bid_amount || ' coins on ' || v_card_title,
      jsonb_build_object(
        'auction_id', NEW.auction_id,
        'card_id', v_auction.card_id,
        'new_bid', NEW.bid_amount,
        'bidder', v_new_bidder_username
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for outbid notifications
CREATE TRIGGER on_new_bid_notify
  AFTER INSERT ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_outbid();

-- Create function to notify auction winner/loser when auction ends
CREATE OR REPLACE FUNCTION public.notify_auction_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_title TEXT;
  v_winner_username TEXT;
  v_seller_username TEXT;
BEGIN
  -- Only trigger when status changes to completed
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    v_card_title := 'Card #' || NEW.card_id;
    
    -- Get usernames
    SELECT username INTO v_seller_username FROM public.profiles WHERE user_id = NEW.user_id;
    
    IF NEW.highest_bidder_id IS NOT NULL THEN
      SELECT username INTO v_winner_username FROM public.profiles WHERE user_id = NEW.highest_bidder_id;
      
      -- Notify winner
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.highest_bidder_id,
        'auction_won',
        'You won the auction!',
        'You won ' || v_card_title || ' for ' || NEW.current_bid || ' coins',
        jsonb_build_object(
          'auction_id', NEW.id,
          'card_id', NEW.card_id,
          'final_bid', NEW.current_bid
        )
      );
      
      -- Notify seller of sale
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.user_id,
        'auction_sold',
        'Your auction sold!',
        v_card_title || ' sold for ' || NEW.current_bid || ' coins to ' || v_winner_username,
        jsonb_build_object(
          'auction_id', NEW.id,
          'card_id', NEW.card_id,
          'final_bid', NEW.current_bid,
          'winner', v_winner_username
        )
      );
      
      -- Notify other bidders they lost
      INSERT INTO public.notifications (user_id, type, title, message, data)
      SELECT DISTINCT 
        ab.user_id,
        'auction_lost',
        'Auction ended',
        v_card_title || ' was won by ' || v_winner_username || ' for ' || NEW.current_bid || ' coins',
        jsonb_build_object(
          'auction_id', NEW.id,
          'card_id', NEW.card_id,
          'final_bid', NEW.current_bid,
          'winner', v_winner_username
        )
      FROM public.auction_bids ab
      WHERE ab.auction_id = NEW.id
        AND ab.user_id != NEW.highest_bidder_id
        AND ab.user_id != NEW.user_id;
    ELSE
      -- No bids, notify seller
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.user_id,
        'auction_expired',
        'Auction ended with no bids',
        v_card_title || ' received no bids',
        jsonb_build_object(
          'auction_id', NEW.id,
          'card_id', NEW.card_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auction result notifications
CREATE TRIGGER on_auction_complete_notify
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auction_result();