import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { useUserCards } from "./useUserCards";
import { toast } from "sonner";

interface Pack {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  cards_per_pack: number;
  is_active: boolean;
}

interface PackCard {
  id: string;
  pack_id: string;
  card_id: number;
  rarity_weight: number;
}

export function usePacks() {
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { addCard } = useUserCards();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPacks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("packs")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPacks(data || []);
    } catch (error) {
      console.error("Error fetching packs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const getPackCards = useCallback(async (packId: string): Promise<PackCard[]> => {
    try {
      const { data, error } = await supabase
        .from("pack_cards")
        .select("*")
        .eq("pack_id", packId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching pack cards:", error);
      return [];
    }
  }, []);

  const openPack = useCallback(
    async (packId: string): Promise<number[] | null> => {
      if (!user || !profile) return null;

      const pack = packs.find((p) => p.id === packId);
      if (!pack) {
        toast.error("Pack not found");
        return null;
      }

      // Check if user has free packs or enough coins
      const hasFreePack = (profile.free_packs_remaining ?? 0) > 0;
      const effectiveCost = hasFreePack ? 0 : pack.cost;

      if (!hasFreePack && profile.coins < pack.cost) {
        toast.error("Not enough coins!");
        return null;
      }

      try {
        // Get pack cards with weights
        const packCards = await getPackCards(packId);
        if (packCards.length === 0) {
          toast.error("This pack has no cards");
          return null;
        }

        // Calculate total weight
        const totalWeight = packCards.reduce((sum, pc) => sum + pc.rarity_weight, 0);

        // Draw cards based on weighted random selection
        const drawnCards: number[] = [];
        for (let i = 0; i < pack.cards_per_pack; i++) {
          let random = Math.random() * totalWeight;
          for (const pc of packCards) {
            random -= pc.rarity_weight;
            if (random <= 0) {
              drawnCards.push(pc.card_id);
              break;
            }
          }
        }

        // Update profile - deduct coins and/or free packs
        if (hasFreePack) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ free_packs_remaining: (profile.free_packs_remaining ?? 1) - 1 })
            .eq("user_id", user.id);

          if (updateError) throw updateError;
          toast.success(`Used a free pack! ${(profile.free_packs_remaining ?? 1) - 1} remaining`);
        } else {
          const { error: coinError } = await supabase
            .from("profiles")
            .update({ coins: profile.coins - pack.cost })
            .eq("user_id", user.id);

          if (coinError) throw coinError;
        }

        // Increment packs_opened in player_stats
        const { data: currentStats } = await supabase
          .from("player_stats")
          .select("packs_opened")
          .eq("user_id", user.id)
          .single();
        
        if (currentStats) {
          await supabase
            .from("player_stats")
            .update({ packs_opened: (currentStats.packs_opened || 0) + 1 })
            .eq("user_id", user.id);
        } else {
          await supabase
            .from("player_stats")
            .insert({ user_id: user.id, packs_opened: 1 });
        }

        // Add cards to user's collection
        for (const cardId of drawnCards) {
          await addCard(cardId, 1);
        }

        await refetchProfile();
        if (!hasFreePack) {
          toast.success(`Opened ${pack.name}!`);
        }
        return drawnCards;
      } catch (error) {
        console.error("Error opening pack:", error);
        toast.error("Failed to open pack");
        return null;
      }
    },
    [user, profile, packs, getPackCards, addCard, refetchProfile]
  );

  return {
    packs,
    loading,
    openPack,
    refetch: fetchPacks,
  };
}
