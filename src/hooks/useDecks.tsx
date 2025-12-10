import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";


interface Deck {
  id: string;
  slot: string;
  card_ids: number[];
  created_at: string;
  updated_at: string;
}

const DECK_SLOTS = ["A", "B", "C", "D"];

export const useDecks = () => {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const createEmptyDecks = useCallback(async () => {
    if (!user) return;

    try {
      // Create empty decks for all 4 slots (A will be filled when user claims starter deck)
      const deckInserts = DECK_SLOTS.map(slot => ({
        user_id: user.id,
        slot,
        card_ids: [],
      }));

      const { error } = await supabase
        .from("decks")
        .insert(deckInserts);

      if (error) {
        // Ignore unique constraint errors (decks already exist)
        if (!error.message.includes("duplicate")) {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error creating empty decks:", error);
    }
  }, [user]);

  const fetchDecks = useCallback(async () => {
    if (!user) {
      setDecks([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("decks")
        .select("*")
        .eq("user_id", user.id)
        .order("slot");

      if (error) throw error;

      // If user has no decks, create starter decks
      if (!data || data.length === 0) {
        if (!initialized) {
          setInitialized(true);
          await createEmptyDecks();
          // Refetch after creating
          const { data: newData } = await supabase
            .from("decks")
            .select("*")
            .eq("user_id", user.id)
            .order("slot");
          setDecks(newData || []);
        }
      } else {
        setDecks(data);
      }
    } catch (error) {
      console.error("Error fetching decks:", error);
      toast.error("Failed to load decks");
    } finally {
      setLoading(false);
    }
  }, [user, initialized, createEmptyDecks]);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  const getDeckBySlot = (slot: string): Deck | undefined => {
    return decks.find((d) => d.slot === slot);
  };

  const saveDeck = async (slot: string, cardIds: number[]) => {
    if (!user) {
      toast.error("Please sign in to save decks");
      return false;
    }

    try {
      const existingDeck = getDeckBySlot(slot);

      if (existingDeck) {
        const { error } = await supabase
          .from("decks")
          .update({ card_ids: cardIds })
          .eq("id", existingDeck.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("decks")
          .insert({ user_id: user.id, slot, card_ids: cardIds });

        if (error) throw error;
      }

      await fetchDecks();
      toast.success("Deck saved!");
      return true;
    } catch (error) {
      console.error("Error saving deck:", error);
      toast.error("Failed to save deck");
      return false;
    }
  };

  const resetDeck = async (slot: string) => {
    if (!user) {
      toast.error("Please sign in to reset decks");
      return false;
    }

    try {
      const existingDeck = getDeckBySlot(slot);

      if (existingDeck) {
        const { error } = await supabase
          .from("decks")
          .update({ card_ids: [] })
          .eq("id", existingDeck.id);

        if (error) throw error;
      }

      await fetchDecks();
      toast.success(`Deck ${slot} reset!`);
      return true;
    } catch (error) {
      console.error("Error resetting deck:", error);
      toast.error("Failed to reset deck");
      return false;
    }
  };

  const getDecksWithSlots = () => {
    return DECK_SLOTS.map((slot) => {
      const deck = getDeckBySlot(slot);
      return {
        slot,
        name: `Deck ${slot}`,
        cardIds: deck?.card_ids || [],
        filled: deck?.card_ids?.length || 0,
      };
    });
  };

  return {
    decks,
    loading,
    getDeckBySlot,
    saveDeck,
    resetDeck,
    getDecksWithSlots,
    refetch: fetchDecks,
  };
};