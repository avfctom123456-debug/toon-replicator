import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { useUserCards } from "./useUserCards";
import { starterDecks } from "@/lib/starterDecks";
import { toast } from "sonner";

export function useStarterDeck() {
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { addMultipleCards, refetch: refetchCards } = useUserCards();

  const claimStarterDeck = useCallback(
    async (slot: string): Promise<boolean> => {
      if (!user || !profile) return false;

      if (profile.starter_deck_claimed) {
        toast.error("You've already claimed a starter deck!");
        return false;
      }

      const deck = starterDecks.find((d) => d.slot === slot);
      if (!deck) {
        toast.error("Invalid starter deck");
        return false;
      }

      try {
        // Add all cards from the starter deck to user's collection
        await addMultipleCards(deck.cardIds);

        // Save the starter deck cards to Deck A
        const { error: deckError } = await supabase
          .from("decks")
          .upsert({ 
            user_id: user.id, 
            slot: "A", 
            card_ids: deck.cardIds 
          }, { 
            onConflict: "user_id,slot" 
          });

        if (deckError) {
          console.error("Error saving deck A:", deckError);
          // Try update instead if upsert fails
          await supabase
            .from("decks")
            .update({ card_ids: deck.cardIds })
            .eq("user_id", user.id)
            .eq("slot", "A");
        }

        // Mark the starter deck as claimed
        const { error } = await supabase
          .from("profiles")
          .update({ starter_deck_claimed: slot })
          .eq("user_id", user.id);

        if (error) throw error;

        await refetchProfile();
        await refetchCards();
        toast.success(`Claimed ${deck.name} starter deck!`);
        return true;
      } catch (error) {
        console.error("Error claiming starter deck:", error);
        toast.error("Failed to claim starter deck");
        return false;
      }
    },
    [user, profile, addMultipleCards, refetchProfile, refetchCards]
  );

  const hasClaimedStarterDeck = profile?.starter_deck_claimed != null;

  return {
    claimStarterDeck,
    hasClaimedStarterDeck,
    claimedDeckSlot: profile?.starter_deck_claimed,
  };
}
