import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { useUserCards } from "./useUserCards";
import { toast } from "sonner";

interface OfferCardWithCopy {
  card_id: number;
  user_card_id: string;
  copy_number: number | null;
}

interface Trade {
  id: string;
  user_id: string;
  status: "open" | "completed" | "cancelled";
  offer_card_ids: number[];
  offer_user_card_ids: string[] | null;
  offer_cards_with_copies: OfferCardWithCopy[];
  offer_coins: number;
  want_card_ids: number[];
  want_coins: number;
  completed_by: string | null;
  created_at: string;
}

export function useTrades() {
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { hasCard, getCardQuantity, addCard, removeCard, refetch: refetchCards } = useUserCards();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch copy numbers for offered cards
      const tradesWithCopies = await Promise.all(
        (data || []).map(async (trade) => {
          const offerUserCardIds = trade.offer_user_card_ids || [];
          let offerCardsWithCopies: OfferCardWithCopy[] = [];

          if (offerUserCardIds.length > 0) {
            const { data: userCardsData } = await supabase
              .from("user_cards")
              .select("id, card_id, copy_number")
              .in("id", offerUserCardIds);

            offerCardsWithCopies = (userCardsData || []).map(uc => ({
              card_id: uc.card_id,
              user_card_id: uc.id,
              copy_number: uc.copy_number,
            }));
          }

          return {
            ...trade,
            offer_cards_with_copies: offerCardsWithCopies,
          } as Trade;
        })
      );

      setTrades(tradesWithCopies);
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const createTrade = useCallback(
    async (
      offerCardIds: number[],
      offerCoins: number,
      wantCardIds: number[],
      wantCoins: number,
      offerUserCardIds?: string[]
    ): Promise<boolean> => {
      if (!user) return false;

      // Validate user has the cards they're offering
      for (const cardId of offerCardIds) {
        if (!hasCard(cardId)) {
          toast.error("You don't own one of the cards you're offering");
          return false;
        }
      }

      // Validate user has enough coins
      if (profile && offerCoins > profile.coins) {
        toast.error("You don't have enough coins to offer");
        return false;
      }

      try {
        const { error } = await supabase.from("trades").insert({
          user_id: user.id,
          offer_card_ids: offerCardIds,
          offer_user_card_ids: offerUserCardIds || [],
          offer_coins: offerCoins,
          want_card_ids: wantCardIds,
          want_coins: wantCoins,
        });

        if (error) throw error;

        await fetchTrades();
        toast.success("Trade created!");
        return true;
      } catch (error) {
        console.error("Error creating trade:", error);
        toast.error("Failed to create trade");
        return false;
      }
    },
    [user, profile, hasCard, fetchTrades]
  );

  const acceptTrade = useCallback(
    async (tradeId: string): Promise<boolean> => {
      if (!user || !profile) return false;

      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) {
        toast.error("Trade not found");
        return false;
      }

      if (trade.user_id === user.id) {
        toast.error("You can't accept your own trade");
        return false;
      }

      // Check if accepter has the wanted cards
      for (const cardId of trade.want_card_ids) {
        if (!hasCard(cardId)) {
          toast.error("You don't have the cards the trader wants");
          return false;
        }
      }

      // Check if accepter has enough coins
      if (trade.want_coins > profile.coins) {
        toast.error("You don't have enough coins");
        return false;
      }

      try {
        // Get trader's profile
        const { data: traderProfile, error: traderError } = await supabase
          .from("profiles")
          .select("coins")
          .eq("user_id", trade.user_id)
          .single();

        if (traderError) throw traderError;

        // Execute the trade
        // 1. Remove offered cards from trader, add to accepter
        for (const cardId of trade.offer_card_ids) {
          // Remove from trader's collection via RPC or direct query
          const { error: removeError } = await supabase
            .from("user_cards")
            .update({ quantity: 0 })
            .eq("user_id", trade.user_id)
            .eq("card_id", cardId);
          
          // Add to accepter
          await addCard(cardId, 1);
        }

        // 2. Remove wanted cards from accepter, add to trader
        for (const cardId of trade.want_card_ids) {
          await removeCard(cardId, 1);
          
          // Add to trader
          const { data: existing } = await supabase
            .from("user_cards")
            .select("*")
            .eq("user_id", trade.user_id)
            .eq("card_id", cardId)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("user_cards")
              .update({ quantity: existing.quantity + 1 })
              .eq("id", existing.id);
          } else {
            await supabase.from("user_cards").insert({
              user_id: trade.user_id,
              card_id: cardId,
              quantity: 1,
            });
          }
        }

        // 3. Transfer coins
        const accepterNewCoins = profile.coins - trade.want_coins + trade.offer_coins;
        const traderNewCoins = traderProfile.coins - trade.offer_coins + trade.want_coins;

        await supabase
          .from("profiles")
          .update({ coins: accepterNewCoins })
          .eq("user_id", user.id);

        await supabase
          .from("profiles")
          .update({ coins: traderNewCoins })
          .eq("user_id", trade.user_id);

        // 4. Mark trade as completed
        await supabase
          .from("trades")
          .update({ status: "completed", completed_by: user.id })
          .eq("id", tradeId);

        await fetchTrades();
        await refetchProfile();
        await refetchCards();
        toast.success("Trade completed!");
        return true;
      } catch (error) {
        console.error("Error accepting trade:", error);
        toast.error("Failed to complete trade");
        return false;
      }
    },
    [user, profile, trades, hasCard, addCard, removeCard, fetchTrades, refetchProfile, refetchCards]
  );

  const cancelTrade = useCallback(
    async (tradeId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from("trades")
          .update({ status: "cancelled" })
          .eq("id", tradeId)
          .eq("user_id", user.id);

        if (error) throw error;

        await fetchTrades();
        toast.success("Trade cancelled");
        return true;
      } catch (error) {
        console.error("Error cancelling trade:", error);
        toast.error("Failed to cancel trade");
        return false;
      }
    },
    [user, fetchTrades]
  );

  return {
    trades,
    loading,
    createTrade,
    acceptTrade,
    cancelTrade,
    refetch: fetchTrades,
  };
}
