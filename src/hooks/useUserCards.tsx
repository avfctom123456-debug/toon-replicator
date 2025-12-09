import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface UserCard {
  id: string;
  card_id: number;
  quantity: number;
  acquired_at: string;
  copy_number: number | null;
}

export function useUserCards() {
  const { user } = useAuth();
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserCards = useCallback(async () => {
    if (!user) {
      setUserCards([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_cards")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setUserCards(data || []);
    } catch (error) {
      console.error("Error fetching user cards:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserCards();
  }, [fetchUserCards]);

  const getOwnedCardIds = useCallback((): number[] => {
    return userCards.map((uc) => uc.card_id);
  }, [userCards]);

  const hasCard = useCallback(
    (cardId: number): boolean => {
      return userCards.some((uc) => uc.card_id === cardId);
    },
    [userCards]
  );

  const getCardQuantity = useCallback(
    (cardId: number): number => {
      const card = userCards.find((uc) => uc.card_id === cardId);
      return card?.quantity || 0;
    },
    [userCards]
  );

  const getCardCopyNumbers = useCallback(
    (cardId: number): number[] => {
      const card = userCards.find((uc) => uc.card_id === cardId);
      if (!card || !card.copy_number) return [];
      // For quantity > 1, we have sequential copy numbers starting from the stored one
      const copies: number[] = [];
      for (let i = 0; i < card.quantity; i++) {
        copies.push(card.copy_number + i);
      }
      return copies;
    },
    [userCards]
  );

  const addCard = useCallback(
    async (cardId: number, quantity: number = 1): Promise<boolean> => {
      if (!user) return false;

      try {
        const existing = userCards.find((uc) => uc.card_id === cardId);

        if (existing) {
          const { error } = await supabase
            .from("user_cards")
            .update({ quantity: existing.quantity + quantity })
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_cards").insert({
            user_id: user.id,
            card_id: cardId,
            quantity,
          });

          if (error) throw error;
        }

        await fetchUserCards();
        return true;
      } catch (error) {
        console.error("Error adding card:", error);
        return false;
      }
    },
    [user, userCards, fetchUserCards]
  );

  const removeCard = useCallback(
    async (cardId: number, quantity: number = 1): Promise<boolean> => {
      if (!user) return false;

      try {
        const existing = userCards.find((uc) => uc.card_id === cardId);
        if (!existing || existing.quantity < quantity) return false;

        if (existing.quantity === quantity) {
          const { error } = await supabase
            .from("user_cards")
            .delete()
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_cards")
            .update({ quantity: existing.quantity - quantity })
            .eq("id", existing.id);

          if (error) throw error;
        }

        await fetchUserCards();
        return true;
      } catch (error) {
        console.error("Error removing card:", error);
        return false;
      }
    },
    [user, userCards, fetchUserCards]
  );

  const addMultipleCards = useCallback(
    async (cardIds: number[]): Promise<boolean> => {
      if (!user) return false;

      try {
        for (const cardId of cardIds) {
          await addCard(cardId, 1);
        }
        return true;
      } catch (error) {
        console.error("Error adding multiple cards:", error);
        return false;
      }
    },
    [user, addCard]
  );

  return {
    userCards,
    loading,
    getOwnedCardIds,
    hasCard,
    getCardQuantity,
    getCardCopyNumbers,
    addCard,
    removeCard,
    addMultipleCards,
    refetch: fetchUserCards,
  };
}
