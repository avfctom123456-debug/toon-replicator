-- Add Cartoon Orbit mode settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN orbit_mode_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN czone_background text DEFAULT 'dexter';

-- Create cMart table for direct card purchases
CREATE TABLE public.cmart_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id integer NOT NULL,
  price integer NOT NULL DEFAULT 100,
  stock integer NOT NULL DEFAULT 10,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on cmart_listings
ALTER TABLE public.cmart_listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
CREATE POLICY "Anyone can view active cmart listings" 
ON public.cmart_listings 
FOR SELECT 
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage listings
CREATE POLICY "Admins can manage cmart listings" 
ON public.cmart_listings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create available cZone backgrounds list
CREATE TABLE public.czone_backgrounds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  unlock_requirement text DEFAULT 'free',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.czone_backgrounds ENABLE ROW LEVEL SECURITY;

-- Anyone can view backgrounds
CREATE POLICY "Anyone can view czone backgrounds" 
ON public.czone_backgrounds 
FOR SELECT 
USING (true);

-- Admins can manage backgrounds
CREATE POLICY "Admins can manage czone backgrounds" 
ON public.czone_backgrounds 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default backgrounds based on Cartoon Orbit worlds
INSERT INTO public.czone_backgrounds (name, slug, unlock_requirement) VALUES
('Dexter''s Lab', 'dexter', 'free'),
('Powerpuff Girls', 'powerpuff', 'free'),
('Johnny Bravo', 'johnny', 'free'),
('Courage the Cowardly Dog', 'courage', 'free'),
('Ed, Edd n Eddy', 'ed', 'free'),
('Samurai Jack', 'samurai', 'collection_50'),
('Grim Adventures', 'grim', 'collection_75'),
('Teen Titans', 'titans', 'pvp_wins_25'),
('Foster''s Home', 'fosters', 'pvp_wins_50');