
-- Step 1: Drop the unique constraint on user_id, card_id
ALTER TABLE public.user_cards DROP CONSTRAINT IF EXISTS user_cards_user_id_card_id_key;

-- Step 2: Create a temporary function to expand rows
CREATE OR REPLACE FUNCTION public.expand_user_cards()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  i INTEGER;
  next_copy INTEGER;
BEGIN
  FOR r IN SELECT * FROM public.user_cards WHERE quantity > 1 LOOP
    -- Insert additional rows for quantity > 1
    FOR i IN 2..r.quantity LOOP
      next_copy := public.get_next_copy_number(r.card_id);
      INSERT INTO public.user_cards (user_id, card_id, quantity, copy_number, acquired_at)
      VALUES (r.user_id, r.card_id, 1, next_copy, r.acquired_at);
    END LOOP;
    -- Update original row to quantity = 1
    UPDATE public.user_cards SET quantity = 1 WHERE id = r.id;
  END LOOP;
END;
$$;

-- Run the expansion
SELECT public.expand_user_cards();

-- Drop the temporary function
DROP FUNCTION public.expand_user_cards();

-- Step 3: Add user_card_id to auctions (references specific copy)
ALTER TABLE public.auctions 
ADD COLUMN user_card_id uuid REFERENCES public.user_cards(id);

-- Step 4: Add offer_user_card_ids to trades (specific copies being offered)
ALTER TABLE public.trades
ADD COLUMN offer_user_card_ids uuid[] DEFAULT '{}';

-- Step 5: Update the end_auction function to transfer specific copy
CREATE OR REPLACE FUNCTION public.end_auction(p_auction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction RECORD;
  v_winner_id UUID;
  v_seller_id UUID;
  v_card_id INTEGER;
  v_user_card_id UUID;
  v_final_bid INTEGER;
  v_copy_number INTEGER;
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
    v_user_card_id := v_auction.user_card_id;
    v_final_bid := v_auction.current_bid;
    
    -- Deduct coins from winner
    UPDATE public.profiles
    SET coins = coins - v_final_bid
    WHERE user_id = v_winner_id;
    
    -- Add coins to seller
    UPDATE public.profiles
    SET coins = coins + v_final_bid
    WHERE user_id = v_seller_id;
    
    -- Transfer specific card copy to winner
    IF v_user_card_id IS NOT NULL THEN
      -- Get the copy number before transfer
      SELECT copy_number INTO v_copy_number FROM public.user_cards WHERE id = v_user_card_id;
      
      -- Delete seller's copy
      DELETE FROM public.user_cards WHERE id = v_user_card_id;
      
      -- Create new copy for winner with same copy number
      INSERT INTO public.user_cards (user_id, card_id, quantity, copy_number)
      VALUES (v_winner_id, v_card_id, 1, v_copy_number);
    ELSE
      -- Legacy: remove by card_id if no specific copy (pick one row)
      DELETE FROM public.user_cards 
      WHERE id = (SELECT id FROM public.user_cards WHERE user_id = v_seller_id AND card_id = v_card_id LIMIT 1);
      
      INSERT INTO public.user_cards (user_id, card_id, quantity)
      VALUES (v_winner_id, v_card_id, 1);
    END IF;
    
    RETURN jsonb_build_object('success', true, 'winner_id', v_winner_id, 'final_bid', v_final_bid);
  ELSE
    RETURN jsonb_build_object('success', true, 'winner_id', null, 'message', 'No bids placed');
  END IF;
END;
$$;

-- Step 6: Create a function to complete trades with specific copies
CREATE OR REPLACE FUNCTION public.complete_trade(p_trade_id uuid, p_acceptor_user_card_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trade RECORD;
  v_acceptor_id UUID;
  v_offer_card RECORD;
  v_want_card RECORD;
  v_user_card_id UUID;
BEGIN
  v_acceptor_id := auth.uid();
  
  IF v_acceptor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get trade details
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  IF v_trade IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade not found');
  END IF;
  
  IF v_trade.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trade is not open');
  END IF;
  
  IF v_trade.user_id = v_acceptor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot accept your own trade');
  END IF;
  
  -- Transfer offered cards from poster to acceptor
  FOR v_user_card_id IN SELECT unnest(v_trade.offer_user_card_ids) LOOP
    SELECT * INTO v_offer_card FROM public.user_cards WHERE id = v_user_card_id;
    IF v_offer_card IS NOT NULL THEN
      DELETE FROM public.user_cards WHERE id = v_user_card_id;
      INSERT INTO public.user_cards (user_id, card_id, quantity, copy_number)
      VALUES (v_acceptor_id, v_offer_card.card_id, 1, v_offer_card.copy_number);
    END IF;
  END LOOP;
  
  -- Transfer wanted cards from acceptor to poster
  FOR v_user_card_id IN SELECT unnest(p_acceptor_user_card_ids) LOOP
    SELECT * INTO v_want_card FROM public.user_cards WHERE id = v_user_card_id;
    IF v_want_card IS NOT NULL THEN
      DELETE FROM public.user_cards WHERE id = v_user_card_id;
      INSERT INTO public.user_cards (user_id, card_id, quantity, copy_number)
      VALUES (v_trade.user_id, v_want_card.card_id, 1, v_want_card.copy_number);
    END IF;
  END LOOP;
  
  -- Transfer coins
  IF v_trade.offer_coins > 0 THEN
    UPDATE public.profiles SET coins = coins - v_trade.offer_coins WHERE user_id = v_trade.user_id;
    UPDATE public.profiles SET coins = coins + v_trade.offer_coins WHERE user_id = v_acceptor_id;
  END IF;
  
  IF v_trade.want_coins > 0 THEN
    UPDATE public.profiles SET coins = coins - v_trade.want_coins WHERE user_id = v_acceptor_id;
    UPDATE public.profiles SET coins = coins + v_trade.want_coins WHERE user_id = v_trade.user_id;
  END IF;
  
  -- Mark trade as completed
  UPDATE public.trades SET status = 'completed', completed_by = v_acceptor_id WHERE id = p_trade_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
