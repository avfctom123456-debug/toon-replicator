-- Allow anyone to view matches that are part of a tournament (for spectating)
CREATE POLICY "Anyone can spectate tournament matches"
ON public.matches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tournament_matches tm
    WHERE tm.match_id = matches.id
  )
);