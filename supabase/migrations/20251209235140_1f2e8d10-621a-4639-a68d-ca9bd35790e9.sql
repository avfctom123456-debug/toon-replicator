
-- Add copy_number column to user_cards
ALTER TABLE public.user_cards 
ADD COLUMN copy_number integer;

-- Create a function to get the next copy number for a card
CREATE OR REPLACE FUNCTION public.get_next_copy_number(p_card_id integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(copy_number), 0) + 1 INTO next_num
  FROM public.user_cards
  WHERE card_id = p_card_id AND copy_number IS NOT NULL;
  RETURN next_num;
END;
$$;

-- Create a trigger to auto-assign copy numbers on insert
CREATE OR REPLACE FUNCTION public.assign_copy_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.copy_number IS NULL THEN
    NEW.copy_number := public.get_next_copy_number(NEW.card_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_copy_number
BEFORE INSERT ON public.user_cards
FOR EACH ROW
EXECUTE FUNCTION public.assign_copy_number();

-- Update existing cards with copy numbers (ordered by acquired_at)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY acquired_at, id) as num
  FROM public.user_cards
)
UPDATE public.user_cards uc
SET copy_number = numbered.num
FROM numbered
WHERE uc.id = numbered.id;
