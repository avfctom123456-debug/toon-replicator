-- Fix function search path for calculate_elo_change
CREATE OR REPLACE FUNCTION public.calculate_elo_change(
  winner_elo INTEGER,
  loser_elo INTEGER,
  k_factor INTEGER DEFAULT 32
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  expected_score FLOAT;
  elo_change INTEGER;
BEGIN
  -- Calculate expected score for winner
  expected_score := 1.0 / (1.0 + power(10, (loser_elo - winner_elo)::FLOAT / 400.0));
  -- Calculate ELO change (winner gets positive, loser gets negative)
  elo_change := round(k_factor * (1 - expected_score));
  RETURN elo_change;
END;
$$;