-- Create function to complete tournament and distribute prizes
CREATE OR REPLACE FUNCTION public.complete_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament RECORD;
  v_final_match RECORD;
  v_semifinal_losers UUID[];
  v_prize_1st INTEGER;
  v_prize_2nd INTEGER;
  v_prize_3rd INTEGER;
  v_third_place_id UUID;
BEGIN
  -- Only admins can complete tournaments
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin only');
  END IF;

  -- Get tournament
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  
  IF v_tournament IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  IF v_tournament.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is not active');
  END IF;

  -- Get the final match (highest round, match_number = 1)
  SELECT * INTO v_final_match 
  FROM public.tournament_matches 
  WHERE tournament_id = p_tournament_id 
  ORDER BY round DESC, match_number ASC 
  LIMIT 1;

  IF v_final_match IS NULL OR v_final_match.winner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Final match not yet completed');
  END IF;

  -- Calculate prize distribution (50% / 30% / 20%)
  v_prize_1st := FLOOR(v_tournament.prize_pool * 0.50);
  v_prize_2nd := FLOOR(v_tournament.prize_pool * 0.30);
  v_prize_3rd := FLOOR(v_tournament.prize_pool * 0.20);

  -- 1st place: winner of final match
  UPDATE public.tournament_participants 
  SET placement = 1, prize_won = v_prize_1st
  WHERE tournament_id = p_tournament_id AND user_id = v_final_match.winner_id;

  UPDATE public.profiles 
  SET coins = coins + v_prize_1st 
  WHERE user_id = v_final_match.winner_id;

  -- 2nd place: loser of final match
  UPDATE public.tournament_participants 
  SET placement = 2, prize_won = v_prize_2nd, eliminated = true, eliminated_at = now()
  WHERE tournament_id = p_tournament_id 
  AND user_id = CASE 
    WHEN v_final_match.player1_id = v_final_match.winner_id THEN v_final_match.player2_id 
    ELSE v_final_match.player1_id 
  END;

  UPDATE public.profiles 
  SET coins = coins + v_prize_2nd 
  WHERE user_id = CASE 
    WHEN v_final_match.player1_id = v_final_match.winner_id THEN v_final_match.player2_id 
    ELSE v_final_match.player1_id 
  END;

  -- 3rd place: Get losers from semifinal round (round before final)
  -- For simplicity, pick the first semifinal loser as 3rd place
  SELECT CASE 
    WHEN player1_id = winner_id THEN player2_id 
    ELSE player1_id 
  END INTO v_third_place_id
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id 
  AND round = v_final_match.round - 1
  AND winner_id IS NOT NULL
  ORDER BY match_number ASC
  LIMIT 1;

  IF v_third_place_id IS NOT NULL THEN
    UPDATE public.tournament_participants 
    SET placement = 3, prize_won = v_prize_3rd, eliminated = true, eliminated_at = now()
    WHERE tournament_id = p_tournament_id AND user_id = v_third_place_id;

    UPDATE public.profiles 
    SET coins = coins + v_prize_3rd 
    WHERE user_id = v_third_place_id;
  END IF;

  -- Mark remaining participants as eliminated without placement
  UPDATE public.tournament_participants 
  SET eliminated = true, eliminated_at = COALESCE(eliminated_at, now())
  WHERE tournament_id = p_tournament_id AND placement IS NULL;

  -- Complete the tournament
  UPDATE public.tournaments 
  SET status = 'completed', winner_id = v_final_match.winner_id, updated_at = now()
  WHERE id = p_tournament_id;

  -- Create notifications for winners
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT 
    tp.user_id,
    'tournament_prize',
    CASE tp.placement 
      WHEN 1 THEN 'Tournament Victory!'
      WHEN 2 THEN 'Tournament Runner-Up!'
      WHEN 3 THEN 'Tournament 3rd Place!'
    END,
    'You won ' || tp.prize_won || ' coins in ' || v_tournament.name,
    jsonb_build_object('tournament_id', p_tournament_id, 'placement', tp.placement, 'prize', tp.prize_won)
  FROM public.tournament_participants tp
  WHERE tp.tournament_id = p_tournament_id AND tp.placement IS NOT NULL AND tp.placement <= 3;

  RETURN jsonb_build_object(
    'success', true, 
    'winner_id', v_final_match.winner_id,
    'prizes', jsonb_build_object('1st', v_prize_1st, '2nd', v_prize_2nd, '3rd', v_prize_3rd)
  );
END;
$$;