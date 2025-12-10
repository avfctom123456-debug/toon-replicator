import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CardWin {
  id: string;
  user_id: string;
  card_id: number;
  wins: number;
  created_at: string;
  updated_at: string;
}

export const useCardWins = () => {
  const { user } = useAuth();
  const [cardWins, setCardWins] = useState<CardWin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCardWins = useCallback(async () => {
    if (!user) {
      setCardWins([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("card_wins")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching card wins:", error);
    } else {
      setCardWins(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCardWins();
  }, [fetchCardWins]);

  const incrementCardWins = async (cardIds: number[]) => {
    if (!user || cardIds.length === 0) return false;

    const { error } = await supabase.rpc("increment_card_wins", {
      p_user_id: user.id,
      p_card_ids: cardIds,
    });

    if (error) {
      console.error("Error incrementing card wins:", error);
      return false;
    }

    await fetchCardWins();
    return true;
  };

  const getWinsForCard = (cardId: number): number => {
    const cardWin = cardWins.find((cw) => cw.card_id === cardId);
    return cardWin?.wins || 0;
  };

  return {
    cardWins,
    loading,
    incrementCardWins,
    getWinsForCard,
    refetchCardWins: fetchCardWins,
  };
};
