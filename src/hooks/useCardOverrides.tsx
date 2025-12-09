import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CardOverride {
  id: string;
  card_id: number;
  custom_image_url: string | null;
  custom_title: string | null;
  custom_description: string | null;
  custom_base_points: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCardOverrides() {
  const [overrides, setOverrides] = useState<CardOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverrides = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("card_overrides")
        .select("*");

      if (error) throw error;
      setOverrides(data || []);
    } catch (error) {
      console.error("Error fetching card overrides:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const getOverride = useCallback(
    (cardId: number): CardOverride | undefined => {
      return overrides.find((o) => o.card_id === cardId && o.is_active);
    },
    [overrides]
  );

  const upsertOverride = useCallback(
    async (
      cardId: number,
      data: {
        custom_image_url?: string | null;
        custom_title?: string | null;
        custom_description?: string | null;
        custom_base_points?: number | null;
      }
    ): Promise<boolean> => {
      try {
        const existing = overrides.find((o) => o.card_id === cardId);

        if (existing) {
          const { error } = await supabase
            .from("card_overrides")
            .update(data)
            .eq("id", existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("card_overrides").insert({
            card_id: cardId,
            ...data,
          });

          if (error) throw error;
        }

        await fetchOverrides();
        return true;
      } catch (error) {
        console.error("Error upserting card override:", error);
        return false;
      }
    },
    [overrides, fetchOverrides]
  );

  const deleteOverride = useCallback(
    async (cardId: number): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("card_overrides")
          .delete()
          .eq("card_id", cardId);

        if (error) throw error;
        await fetchOverrides();
        return true;
      } catch (error) {
        console.error("Error deleting card override:", error);
        return false;
      }
    },
    [fetchOverrides]
  );

  const uploadCardImage = useCallback(
    async (cardId: number, file: File): Promise<string | null> => {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${cardId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("card-images")
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("card-images")
          .getPublicUrl(fileName);

        return data.publicUrl;
      } catch (error) {
        console.error("Error uploading card image:", error);
        return null;
      }
    },
    []
  );

  return {
    overrides,
    loading,
    getOverride,
    upsertOverride,
    deleteOverride,
    uploadCardImage,
    refetch: fetchOverrides,
  };
}
