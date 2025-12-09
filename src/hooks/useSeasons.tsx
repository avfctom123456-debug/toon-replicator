import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Season {
  id: string;
  name: string;
  season_number: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SeasonPlayerStats {
  id: string;
  season_id: string;
  user_id: string;
  final_rank: number;
  final_elo: number;
  pvp_wins: number;
  pvp_losses: number;
  pvp_draws: number;
  reward_tier: string;
  reward_coins: number;
  created_at: string;
  username?: string;
}

export const REWARD_TIERS = {
  champion: { name: "Champion", color: "text-purple-400", bgColor: "bg-purple-500/20", coins: 500, minRank: 1, maxRank: 1 },
  diamond: { name: "Diamond", color: "text-cyan-400", bgColor: "bg-cyan-500/20", coins: 300, minRank: 2, maxRank: 5 },
  gold: { name: "Gold", color: "text-yellow-400", bgColor: "bg-yellow-500/20", coins: 150, minRank: 6, maxRank: 20 },
  silver: { name: "Silver", color: "text-gray-300", bgColor: "bg-gray-500/20", coins: 75, minRank: 21, maxRank: 50 },
  bronze: { name: "Bronze", color: "text-amber-600", bgColor: "bg-amber-500/20", coins: 25, minRank: 51, maxRank: 100 },
  participant: { name: "Participant", color: "text-slate-400", bgColor: "bg-slate-500/20", coins: 10, minRank: 101, maxRank: null },
} as const;

export const getTierForRank = (rank: number) => {
  if (rank === 1) return REWARD_TIERS.champion;
  if (rank <= 5) return REWARD_TIERS.diamond;
  if (rank <= 20) return REWARD_TIERS.gold;
  if (rank <= 50) return REWARD_TIERS.silver;
  if (rank <= 100) return REWARD_TIERS.bronze;
  return REWARD_TIERS.participant;
};

export const useSeasons = () => {
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [pastSeasons, setPastSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSeasons = useCallback(async () => {
    setLoading(true);

    // Fetch current active season
    const { data: activeData, error: activeError } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (activeError) {
      console.error("Error fetching active season:", activeError);
    } else {
      setCurrentSeason(activeData);
    }

    // Fetch past seasons
    const { data: pastData, error: pastError } = await supabase
      .from("seasons")
      .select("*")
      .eq("is_active", false)
      .order("season_number", { ascending: false });

    if (pastError) {
      console.error("Error fetching past seasons:", pastError);
    } else {
      setPastSeasons(pastData || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  return { currentSeason, pastSeasons, loading, refetchSeasons: fetchSeasons };
};

export const useSeasonStats = (seasonId: string | null) => {
  const [stats, setStats] = useState<SeasonPlayerStats[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!seasonId) {
      setStats([]);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("season_player_stats")
      .select("*")
      .eq("season_id", seasonId)
      .order("final_rank", { ascending: true });

    if (error) {
      console.error("Error fetching season stats:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setStats([]);
      setLoading(false);
      return;
    }

    // Fetch usernames
    const userIds = data.map((s) => s.user_id);
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const usernameMap = new Map(
      (profilesData || []).map((p) => [p.user_id, p.username])
    );

    const statsWithUsernames = data.map((stat) => ({
      ...stat,
      username: usernameMap.get(stat.user_id) || "Unknown Player",
    }));

    setStats(statsWithUsernames);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading };
};

export const useEndSeason = () => {
  const [loading, setLoading] = useState(false);

  const endSeason = async () => {
    setLoading(true);
    
    const { error } = await supabase.rpc("end_season_and_distribute_rewards");

    setLoading(false);

    if (error) {
      console.error("Error ending season:", error);
      return { success: false, error };
    }

    return { success: true, error: null };
  };

  return { endSeason, loading };
};
