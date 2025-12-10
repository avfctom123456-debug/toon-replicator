-- Add free_packs_remaining column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN free_packs_remaining integer NOT NULL DEFAULT 4;

-- Update existing users to have 0 free packs (they're not new)
UPDATE public.profiles SET free_packs_remaining = 0;