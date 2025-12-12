-- Create storage bucket for czone backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('czone-backgrounds', 'czone-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view czone backgrounds
CREATE POLICY "Anyone can view czone backgrounds"
ON storage.objects FOR SELECT
USING (bucket_id = 'czone-backgrounds');

-- Allow admins to upload czone backgrounds
CREATE POLICY "Admins can upload czone backgrounds"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'czone-backgrounds' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Allow admins to delete czone backgrounds
CREATE POLICY "Admins can delete czone backgrounds"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'czone-backgrounds' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Add canvas_width and canvas_height columns to czone_backgrounds for scaling reference
ALTER TABLE public.czone_backgrounds 
ADD COLUMN IF NOT EXISTS canvas_width integer DEFAULT 1200,
ADD COLUMN IF NOT EXISTS canvas_height integer DEFAULT 675;