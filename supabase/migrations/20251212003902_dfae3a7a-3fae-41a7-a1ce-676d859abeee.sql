-- Add czone name and description fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS czone_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS czone_description text DEFAULT NULL;