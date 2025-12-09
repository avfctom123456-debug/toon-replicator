-- Create auctions table for live bidding
CREATE TABLE public.auctions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_id INTEGER NOT NULL,
  starting_bid INTEGER NOT NULL DEFAULT 10,
  current_bid INTEGER NOT NULL DEFAULT 0,
  highest_bidder_id UUID,
  min_increment INTEGER NOT NULL DEFAULT 5,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;

-- Policies
CREATE POLICY "Anyone can view active auctions"
ON public.auctions
FOR SELECT
USING (status = 'active' OR user_id = auth.uid() OR highest_bidder_id = auth.uid());

CREATE POLICY "Users can create auctions"
ON public.auctions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auctions"
ON public.auctions
FOR UPDATE
USING (auth.uid() = user_id OR status = 'active');

CREATE POLICY "Users can delete own pending auctions"
ON public.auctions
FOR DELETE
USING (auth.uid() = user_id AND status = 'active' AND current_bid = 0);

-- Create auction bids table for bid history
CREATE TABLE public.auction_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bid_amount INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Enable realtime for bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;

-- Policies
CREATE POLICY "Anyone can view bids"
ON public.auction_bids
FOR SELECT
USING (true);

CREATE POLICY "Users can place bids"
ON public.auction_bids
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at on auctions
CREATE TRIGGER update_auctions_updated_at
BEFORE UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to place a bid
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id UUID,
  p_bid_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_user_id UUID;
  v_user_coins INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get auction details
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
  
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction not found');
  END IF;
  
  IF v_auction.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction is not active');
  END IF;
  
  IF v_auction.ends_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction has ended');
  END IF;
  
  IF v_auction.user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot bid on your own auction');
  END IF;
  
  -- Check minimum bid
  IF v_auction.current_bid = 0 THEN
    IF p_bid_amount < v_auction.starting_bid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bid must be at least the starting bid');
    END IF;
  ELSE
    IF p_bid_amount < v_auction.current_bid + v_auction.min_increment THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bid must be at least ' || (v_auction.current_bid + v_auction.min_increment));
    END IF;
  END IF;
  
  -- Check user has enough coins
  SELECT coins INTO v_user_coins FROM public.profiles WHERE user_id = v_user_id;
  
  IF v_user_coins IS NULL OR v_user_coins < p_bid_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;
  
  -- Update auction
  UPDATE public.auctions
  SET current_bid = p_bid_amount,
      highest_bidder_id = v_user_id,
      updated_at = now()
  WHERE id = p_auction_id;
  
  -- Record the bid
  INSERT INTO public.auction_bids (auction_id, user_id, bid_amount)
  VALUES (p_auction_id, v_user_id, p_bid_amount);
  
  RETURN jsonb_build_object('success', true, 'bid', p_bid_amount);
END;
$$;

-- Function to end an auction and transfer assets
CREATE OR REPLACE FUNCTION public.end_auction(p_auction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_winner_id UUID;
  v_seller_id UUID;
  v_card_id INTEGER;
  v_final_bid INTEGER;
BEGIN
  -- Get auction details
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
  
  IF v_auction IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction not found');
  END IF;
  
  IF v_auction.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auction already ended');
  END IF;
  
  -- Mark auction as completed
  UPDATE public.auctions SET status = 'completed' WHERE id = p_auction_id;
  
  -- If there was a winner
  IF v_auction.highest_bidder_id IS NOT NULL THEN
    v_winner_id := v_auction.highest_bidder_id;
    v_seller_id := v_auction.user_id;
    v_card_id := v_auction.card_id;
    v_final_bid := v_auction.current_bid;
    
    -- Deduct coins from winner
    UPDATE public.profiles
    SET coins = coins - v_final_bid
    WHERE user_id = v_winner_id;
    
    -- Add coins to seller
    UPDATE public.profiles
    SET coins = coins + v_final_bid
    WHERE user_id = v_seller_id;
    
    -- Remove card from seller
    UPDATE public.user_cards
    SET quantity = quantity - 1
    WHERE user_id = v_seller_id AND card_id = v_card_id;
    
    -- Delete if quantity is 0
    DELETE FROM public.user_cards
    WHERE user_id = v_seller_id AND card_id = v_card_id AND quantity <= 0;
    
    -- Add card to winner
    INSERT INTO public.user_cards (user_id, card_id, quantity)
    VALUES (v_winner_id, v_card_id, 1)
    ON CONFLICT (user_id, card_id) 
    DO UPDATE SET quantity = user_cards.quantity + 1;
    
    RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id, 'final_bid', v_final_bid);
  ELSE
    -- No bids, return card to seller (nothing to do, they keep it)
    RETURN jsonb_build_object('success', true, 'winner_id', null, 'message', 'No bids placed');
  END IF;
END;
$$;