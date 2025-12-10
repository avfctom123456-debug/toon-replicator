import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PlayerStats {
  id: string;
  user_id: string;
  elo_rating: number;
  pvp_wins: number;
  pvp_losses: number;
  pvp_draws: number;
  cpu_wins: number;
  win_streak: number;
  best_win_streak: number;
  last_match_at: string | null;
  packs_opened: number;
  total_coins_earned: number;
  highest_score: number;
  color_wins: number;
  perfect_wins: number;
  total_card_plays: number;
  total_card_buffs: number;
  total_card_cancels: number;
  total_adjacency_plays: number;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry extends PlayerStats {
  username: string;
  rank: number;
}

export const usePlayerStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching player stats:", error);
    } else {
      setStats(data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const updatePvpStats = async (winnerId: string, loserId: string, isDraw: boolean = false) => {
    const { error } = await supabase.rpc("update_pvp_stats", {
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_is_draw: isDraw,
    });

    if (error) {
      console.error("Error updating PVP stats:", error);
      return false;
    }

    await fetchStats();
    return true;
  };

  const updateCpuWin = async () => {
    if (!user) return false;

    const { error } = await supabase.rpc("update_cpu_win", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error updating CPU win:", error);
      return false;
    }

    await fetchStats();
    return true;
  };

  // Update game-specific stats for achievements
  const updateGameStats = async (options: {
    score?: number;
    isColorWin?: boolean;
    isPerfectWin?: boolean;
    cardPlays?: number;
    cardBuffs?: number;
    cardCancels?: number;
    adjacencyPlays?: number;
  }) => {
    if (!user) return false;

    // Get current stats
    const { data: currentStats } = await supabase
      .from("player_stats")
      .select("highest_score, color_wins, perfect_wins, total_card_plays, total_card_buffs, total_card_cancels, total_adjacency_plays")
      .eq("user_id", user.id)
      .single();

    const updates: Record<string, unknown> = {};

    if (options.score !== undefined) {
      const currentHighest = currentStats?.highest_score || 0;
      if (options.score > currentHighest) {
        updates.highest_score = options.score;
      }
    }

    if (options.isColorWin) {
      updates.color_wins = (currentStats?.color_wins || 0) + 1;
    }

    if (options.isPerfectWin) {
      updates.perfect_wins = (currentStats?.perfect_wins || 0) + 1;
    }

    if (options.cardPlays) {
      updates.total_card_plays = (currentStats?.total_card_plays || 0) + options.cardPlays;
    }

    if (options.cardBuffs) {
      updates.total_card_buffs = (currentStats?.total_card_buffs || 0) + options.cardBuffs;
    }

    if (options.cardCancels) {
      updates.total_card_cancels = (currentStats?.total_card_cancels || 0) + options.cardCancels;
    }

    if (options.adjacencyPlays) {
      updates.total_adjacency_plays = (currentStats?.total_adjacency_plays || 0) + options.adjacencyPlays;
    }

    if (Object.keys(updates).length > 0) {
      if (currentStats) {
        await supabase
          .from("player_stats")
          .update(updates)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("player_stats")
          .insert({ user_id: user.id, ...updates });
      }
    }

    await fetchStats();
    return true;
  };

  return { stats, loading, updatePvpStats, updateCpuWin, updateGameStats, refetchStats: fetchStats };
};

export const useLeaderboard = (limit: number = 50) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);

    // Fetch player stats ordered by ELO
    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select("*")
      .order("elo_rating", { ascending: false })
      .limit(limit);

    if (statsError) {
      console.error("Error fetching leaderboard:", statsError);
      setLoading(false);
      return;
    }

    if (!statsData || statsData.length === 0) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    // Fetch usernames for all players
    const userIds = statsData.map((s) => s.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
    }

    const usernameMap = new Map(
      (profilesData || []).map((p) => [p.user_id, p.username])
    );

    const entries: LeaderboardEntry[] = statsData.map((stat, index) => ({
      ...stat,
      username: usernameMap.get(stat.user_id) || "Unknown Player",
      rank: index + 1,
    }));

    setLeaderboard(entries);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, loading, refetchLeaderboard: fetchLeaderboard };
};
