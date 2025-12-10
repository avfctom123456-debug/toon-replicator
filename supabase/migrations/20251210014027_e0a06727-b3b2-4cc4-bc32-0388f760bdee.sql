-- Allow admins to view all redemptions
CREATE POLICY "Admins can view all redemptions"
ON public.promo_code_redemptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));