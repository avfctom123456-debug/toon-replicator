import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface CZoneBackground {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  unlock_requirement: string;
}

export const useOrbitMode = () => {
  const { user } = useAuth();
  const [orbitModeEnabled, setOrbitModeEnabled] = useState(false);
  const [czoneBackground, setCzoneBackground] = useState<string>("dexter");
  const [backgrounds, setBackgrounds] = useState<CZoneBackground[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [profileRes, backgroundsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("orbit_mode_enabled, czone_background")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("czone_backgrounds")
        .select("*")
        .order("name")
    ]);

    if (profileRes.data) {
      setOrbitModeEnabled(profileRes.data.orbit_mode_enabled || false);
      setCzoneBackground(profileRes.data.czone_background || "dexter");
    }

    if (backgroundsRes.data) {
      setBackgrounds(backgroundsRes.data);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const toggleOrbitMode = async (enabled: boolean) => {
    if (!user) return false;

    const { error } = await supabase
      .from("profiles")
      .update({ orbit_mode_enabled: enabled })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error toggling orbit mode:", error);
      return false;
    }

    setOrbitModeEnabled(enabled);
    return true;
  };

  const updateBackground = async (slug: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from("profiles")
      .update({ czone_background: slug })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error updating background:", error);
      return false;
    }

    setCzoneBackground(slug);
    return true;
  };

  return {
    orbitModeEnabled,
    czoneBackground,
    backgrounds,
    loading,
    toggleOrbitMode,
    updateBackground,
    refetch: fetchSettings
  };
};
