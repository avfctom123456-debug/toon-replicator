import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  coins: number;
  created_at: string;
  updated_at: string;
  starter_deck_claimed: string | null;
  free_packs_remaining: number;
  czone_name: string | null;
  czone_description: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
    } else {
      setProfile(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateCoins = async (newCoins: number) => {
    if (!user || !profile) return false;

    const { error } = await supabase
      .from("profiles")
      .update({ coins: newCoins })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating coins:", error);
      return false;
    }

    setProfile((prev) => prev ? { ...prev, coins: newCoins } : null);
    return true;
  };

  return { profile, loading, updateCoins, refetchProfile: fetchProfile };
};