import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface CZonePlacement {
  id: string;
  user_id: string;
  card_id: number;
  x_position: number;
  y_position: number;
  z_index: number;
  scale: number;
}

export interface CZoneUser {
  user_id: string;
  username: string;
  czone_background: string;
}

export const useCZone = () => {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<CZonePlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayPoints, setTodayPoints] = useState(0);
  const [allUsers, setAllUsers] = useState<CZoneUser[]>([]);

  const fetchPlacements = useCallback(async (userId: string): Promise<CZonePlacement[]> => {
    const { data, error } = await supabase
      .from("czone_placements" as any)
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching placements:", error);
      return [];
    }
    return (data as unknown as CZonePlacement[]) || [];
  }, []);

  const fetchMyPlacements = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const data = await fetchPlacements(user.id);
    setPlacements(data);
    setLoading(false);
  }, [user, fetchPlacements]);

  const fetchTodayPoints = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("czone_visits" as any)
      .select("points_earned")
      .eq("visitor_id", user.id)
      .eq("visit_date", new Date().toISOString().split('T')[0]);

    const records = data as unknown as { points_earned: number }[] | null;
    const total = records?.reduce((sum, v) => sum + v.points_earned, 0) || 0;
    setTodayPoints(total);
  }, [user]);

  const fetchAllUsersWithCZones = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, czone_background")
      .not("czone_background", "is", null);

    if (data) {
      const users = data as unknown as CZoneUser[];
      setAllUsers(users.filter(u => u.user_id !== user?.id));
    }
  }, [user]);

  useEffect(() => {
    fetchMyPlacements();
    fetchTodayPoints();
    fetchAllUsersWithCZones();
  }, [fetchMyPlacements, fetchTodayPoints, fetchAllUsersWithCZones]);

  const savePlacement = async (placement: Omit<CZonePlacement, "id" | "user_id">): Promise<CZonePlacement | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("czone_placements" as any)
      .insert({
        user_id: user.id,
        ...placement
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving placement:", error);
      toast.error("Failed to place card");
      return null;
    }

    const newPlacement = data as unknown as CZonePlacement;
    setPlacements(prev => [...prev, newPlacement]);
    return newPlacement;
  };

  const updatePlacement = async (id: string, updates: Partial<CZonePlacement>): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from("czone_placements" as any)
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating placement:", error);
      return false;
    }

    setPlacements(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    return true;
  };

  const deletePlacement = async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from("czone_placements" as any)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting placement:", error);
      return false;
    }

    setPlacements(prev => prev.filter(p => p.id !== id));
    return true;
  };

  const clearAllPlacements = async (): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from("czone_placements" as any)
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error clearing placements:", error);
      return false;
    }

    setPlacements([]);
    return true;
  };

  const visitCZone = async (visitedUserId: string) => {
    if (!user) return null;

    const { data, error } = await supabase.rpc("visit_czone", {
      p_visited_user_id: visitedUserId
    });

    if (error) {
      console.error("Error visiting cZone:", error);
      return null;
    }

    const result = data as unknown as { success: boolean; today_total?: number; points_earned?: number } | null;
    
    if (result?.success) {
      setTodayPoints(result.today_total || 0);
      toast.success(`+${result.points_earned} coins for visiting!`);
    }

    return result;
  };

  return {
    placements,
    loading,
    todayPoints,
    allUsers,
    fetchPlacements,
    savePlacement,
    updatePlacement,
    deletePlacement,
    clearAllPlacements,
    visitCZone,
    refetch: fetchMyPlacements
  };
};
