-- Drop the czone_visits table to recreate with proper constraint
DROP TABLE IF EXISTS public.czone_visits;

-- Track daily cZone visits for point rewards
CREATE TABLE public.czone_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id uuid NOT NULL,
  visited_user_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  visited_at timestamp with time zone NOT NULL DEFAULT now(),
  points_earned integer NOT NULL DEFAULT 10,
  UNIQUE(visitor_id, visited_user_id, visit_date)
);

-- Enable RLS
ALTER TABLE public.czone_visits ENABLE ROW LEVEL SECURITY;

-- Users can view their own visit history
CREATE POLICY "Users can view own visits" 
ON public.czone_visits 
FOR SELECT 
USING (auth.uid() = visitor_id);

-- Users can record visits
CREATE POLICY "Users can record visits" 
ON public.czone_visits 
FOR INSERT 
WITH CHECK (auth.uid() = visitor_id AND visitor_id != visited_user_id);

-- Function to visit a cZone and earn points
CREATE OR REPLACE FUNCTION public.visit_czone(p_visited_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visitor_id UUID;
  v_today_visits INTEGER;
  v_daily_cap INTEGER := 200;
  v_points_per_visit INTEGER := 10;
  v_already_visited BOOLEAN;
BEGIN
  v_visitor_id := auth.uid();
  
  IF v_visitor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF v_visitor_id = p_visited_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot earn points visiting your own cZone');
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.czone_visits 
    WHERE visitor_id = v_visitor_id 
    AND visited_user_id = p_visited_user_id 
    AND visit_date = CURRENT_DATE
  ) INTO v_already_visited;
  
  IF v_already_visited THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already visited this cZone today', 'already_visited', true);
  END IF;
  
  SELECT COALESCE(SUM(points_earned), 0) INTO v_today_visits 
  FROM public.czone_visits 
  WHERE visitor_id = v_visitor_id AND visit_date = CURRENT_DATE;
  
  IF v_today_visits >= v_daily_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily visit cap reached', 'daily_cap_reached', true);
  END IF;
  
  INSERT INTO public.czone_visits (visitor_id, visited_user_id, visit_date, points_earned)
  VALUES (v_visitor_id, p_visited_user_id, CURRENT_DATE, v_points_per_visit);
  
  UPDATE public.profiles SET coins = coins + v_points_per_visit WHERE user_id = v_visitor_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'points_earned', v_points_per_visit,
    'today_total', v_today_visits + v_points_per_visit
  );
END;
$$;