import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export interface CMartListing {
  id: string;
  card_id: number;
  price: number;
  stock: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

export const useCMart = () => {
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const [listings, setListings] = useState<CMartListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchListings = useCallback(async () => {
    const { data, error } = await supabase
      .from("cmart_listings")
      .select("*")
      .eq("is_active", true)
      .gt("stock", 0)
      .order("is_featured", { ascending: false })
      .order("price", { ascending: true });

    if (error) {
      console.error("Error fetching cMart listings:", error);
    } else {
      setListings(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const purchaseCard = async (listingId: string) => {
    if (!user || !profile) {
      toast.error("You must be logged in to purchase");
      return false;
    }

    const listing = listings.find(l => l.id === listingId);
    if (!listing) {
      toast.error("Listing not found");
      return false;
    }

    if (profile.coins < listing.price) {
      toast.error("Not enough coins!");
      return false;
    }

    if (listing.stock <= 0) {
      toast.error("Out of stock!");
      return false;
    }

    // Deduct coins
    const { error: coinError } = await supabase
      .from("profiles")
      .update({ coins: profile.coins - listing.price })
      .eq("user_id", user.id);

    if (coinError) {
      toast.error("Failed to process payment");
      return false;
    }

    // Reduce stock
    const { error: stockError } = await supabase
      .from("cmart_listings")
      .update({ stock: listing.stock - 1 })
      .eq("id", listingId);

    if (stockError) {
      // Refund coins
      await supabase
        .from("profiles")
        .update({ coins: profile.coins })
        .eq("user_id", user.id);
      toast.error("Failed to update stock");
      return false;
    }

    // Add card to user's collection
    const { error: cardError } = await supabase
      .from("user_cards")
      .insert({
        user_id: user.id,
        card_id: listing.card_id,
        quantity: 1
      });

    if (cardError) {
      console.error("Error adding card:", cardError);
      toast.error("Failed to add card to collection");
      return false;
    }

    toast.success("Card purchased successfully!");
    refetchProfile();
    fetchListings();
    return true;
  };

  return {
    listings,
    loading,
    purchaseCard,
    refetch: fetchListings
  };
};
