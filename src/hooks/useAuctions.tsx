import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Auction {
  id: string;
  user_id: string;
  card_id: number;
  user_card_id: string | null;
  starting_bid: number;
  current_bid: number;
  highest_bidder_id: string | null;
  min_increment: number;
  ends_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  seller_username?: string;
  highest_bidder_username?: string;
  copy_number?: number | null;
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id: string;
  bid_amount: number;
  created_at: string;
  username?: string;
}

export const useAuctions = () => {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("status", "active")
      .order("ends_at", { ascending: true });

    if (error) {
      console.error("Error fetching auctions:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setAuctions([]);
      setLoading(false);
      return;
    }

    // Fetch usernames for sellers and highest bidders
    const userIds = [...new Set([
      ...data.map(a => a.user_id),
      ...data.filter(a => a.highest_bidder_id).map(a => a.highest_bidder_id!)
    ])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const usernameMap = new Map(
      (profiles || []).map(p => [p.user_id, p.username])
    );

    // Fetch copy numbers for user_card_ids
    const userCardIds = data.filter(a => a.user_card_id).map(a => a.user_card_id!);
    let copyNumberMap = new Map<string, number>();
    
    if (userCardIds.length > 0) {
      const { data: userCards } = await supabase
        .from("user_cards")
        .select("id, copy_number")
        .in("id", userCardIds);
      
      copyNumberMap = new Map(
        (userCards || []).map(uc => [uc.id, uc.copy_number])
      );
    }

    const auctionsWithUsernames = data.map(auction => ({
      ...auction,
      seller_username: usernameMap.get(auction.user_id) || "Unknown",
      highest_bidder_username: auction.highest_bidder_id 
        ? usernameMap.get(auction.highest_bidder_id) || "Unknown"
        : null,
      copy_number: auction.user_card_id 
        ? copyNumberMap.get(auction.user_card_id) 
        : null
    }));

    setAuctions(auctionsWithUsernames);
    setLoading(false);
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    fetchAuctions();

    const channel = supabase
      .channel("auctions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions" },
        () => {
          fetchAuctions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAuctions]);

  const createAuction = async (
    cardId: number,
    startingBid: number,
    durationMinutes: number,
    userCardId?: string
  ) => {
    if (!user) return { success: false, error: "Not authenticated" };

    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const { error } = await supabase.from("auctions").insert({
      user_id: user.id,
      card_id: cardId,
      starting_bid: startingBid,
      ends_at: endsAt,
      user_card_id: userCardId || null,
    });

    if (error) {
      console.error("Error creating auction:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const placeBid = async (auctionId: string, bidAmount: number) => {
    const { data, error } = await supabase.rpc("place_bid", {
      p_auction_id: auctionId,
      p_bid_amount: bidAmount,
    });

    if (error) {
      console.error("Error placing bid:", error);
      return { success: false, error: error.message };
    }

    return data as { success: boolean; error?: string; bid?: number };
  };

  const endAuction = async (auctionId: string) => {
    const { data, error } = await supabase.rpc("end_auction", {
      p_auction_id: auctionId,
    });

    if (error) {
      console.error("Error ending auction:", error);
      return { success: false, error: error.message };
    }

    return data as { success: boolean; error?: string };
  };

  const cancelAuction = async (auctionId: string) => {
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("auctions")
      .delete()
      .eq("id", auctionId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error canceling auction:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  return {
    auctions,
    loading,
    createAuction,
    placeBid,
    endAuction,
    cancelAuction,
    refetchAuctions: fetchAuctions,
  };
};

export const useAuctionBids = (auctionId: string | null) => {
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBids = useCallback(async () => {
    if (!auctionId) {
      setBids([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("auction_bids")
      .select("*")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bids:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setBids([]);
      setLoading(false);
      return;
    }

    // Fetch usernames
    const userIds = [...new Set(data.map(b => b.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const usernameMap = new Map(
      (profiles || []).map(p => [p.user_id, p.username])
    );

    const bidsWithUsernames = data.map(bid => ({
      ...bid,
      username: usernameMap.get(bid.user_id) || "Unknown",
    }));

    setBids(bidsWithUsernames);
    setLoading(false);
  }, [auctionId]);

  useEffect(() => {
    fetchBids();

    if (!auctionId) return;

    const channel = supabase
      .channel(`bids-${auctionId}`)
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "auction_bids",
          filter: `auction_id=eq.${auctionId}`
        },
        () => {
          fetchBids();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId, fetchBids]);

  return { bids, loading };
};
