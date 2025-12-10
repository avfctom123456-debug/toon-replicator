-- Create function to notify trade completion
CREATE OR REPLACE FUNCTION public.notify_trade_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acceptor_username TEXT;
  v_offer_count INTEGER;
  v_want_count INTEGER;
BEGIN
  -- Only trigger when status changes to completed
  IF NEW.status = 'completed' AND OLD.status = 'open' THEN
    -- Get acceptor username
    SELECT username INTO v_acceptor_username 
    FROM public.profiles 
    WHERE user_id = NEW.completed_by;
    
    -- Count cards involved
    v_offer_count := array_length(NEW.offer_card_ids, 1);
    v_want_count := array_length(NEW.want_card_ids, 1);
    
    -- Notify trade creator
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'trade_accepted',
      'Trade Accepted!',
      v_acceptor_username || ' accepted your trade offer',
      jsonb_build_object(
        'trade_id', NEW.id,
        'acceptor', v_acceptor_username,
        'offer_card_ids', NEW.offer_card_ids,
        'want_card_ids', NEW.want_card_ids,
        'offer_coins', NEW.offer_coins,
        'want_coins', NEW.want_coins
      )
    );
    
    -- Notify acceptor (confirmation)
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.completed_by,
      'trade_completed',
      'Trade Completed!',
      'You completed a trade successfully',
      jsonb_build_object(
        'trade_id', NEW.id,
        'offer_card_ids', NEW.offer_card_ids,
        'want_card_ids', NEW.want_card_ids,
        'offer_coins', NEW.offer_coins,
        'want_coins', NEW.want_coins
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for trade completion notifications
CREATE TRIGGER on_trade_completed
  AFTER UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trade_completed();