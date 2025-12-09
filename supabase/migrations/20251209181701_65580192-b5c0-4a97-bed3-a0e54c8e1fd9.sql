-- Add currency column to profiles table
ALTER TABLE public.profiles ADD COLUMN coins integer NOT NULL DEFAULT 100;

-- Create a view or index for efficient queries (optional optimization)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);