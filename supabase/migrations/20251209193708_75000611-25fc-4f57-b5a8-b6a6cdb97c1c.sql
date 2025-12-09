-- Create storage bucket for card images
INSERT INTO storage.buckets (id, name, public) VALUES ('card-images', 'card-images', true);

-- Create policy for admins to upload card images
CREATE POLICY "Admins can upload card images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'card-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Create policy for admins to update card images
CREATE POLICY "Admins can update card images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'card-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Create policy for admins to delete card images
CREATE POLICY "Admins can delete card images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'card-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Create policy for anyone to view card images
CREATE POLICY "Anyone can view card images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'card-images');

-- Create card_overrides table for custom card data
CREATE TABLE public.card_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id INTEGER NOT NULL UNIQUE,
  custom_image_url TEXT,
  custom_title TEXT,
  custom_description TEXT,
  custom_base_points INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.card_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage card overrides
CREATE POLICY "Admins can insert card overrides"
ON public.card_overrides
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update card overrides"
ON public.card_overrides
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete card overrides"
ON public.card_overrides
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active card overrides
CREATE POLICY "Anyone can view card overrides"
ON public.card_overrides
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_card_overrides_updated_at
BEFORE UPDATE ON public.card_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();