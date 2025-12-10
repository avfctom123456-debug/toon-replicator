import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ChallengeInvite {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_deck: number[];
  status: string;
  match_id: string | null;
  is_ranked: boolean;
  created_at: string;
  expires_at: string;
  challenger_username?: string;
}

export const useChallenges = () => {
  const { user } = useAuth();
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeInvite[]>([]);
  const [outgoingChallenges, setOutgoingChallenges] = useState<ChallengeInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    if (!user) {
      setIncomingChallenges([]);
      setOutgoingChallenges([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("challenge_invites")
      .select("*")
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (error) {
      console.error("Error fetching challenges:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setIncomingChallenges([]);
      setOutgoingChallenges([]);
      setLoading(false);
      return;
    }

    // Get challenger usernames
    const challengerIds = [...new Set(data.map((c) => c.challenger_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", challengerIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

    const enriched = data.map((c) => ({
      ...c,
      challenger_username: profileMap.get(c.challenger_id),
    }));

    setIncomingChallenges(enriched.filter((c) => c.challenged_id === user.id));
    setOutgoingChallenges(enriched.filter((c) => c.challenger_id === user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchChallenges();

    const channel = supabase
      .channel("challenges-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenge_invites" },
        () => fetchChallenges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChallenges]);

  const sendChallenge = async (friendUserId: string, deckCardIds: number[]) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("challenge_invites")
      .insert({
        challenger_id: user.id,
        challenged_id: friendUserId,
        challenger_deck: deckCardIds,
        is_ranked: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending challenge:", error);
      return null;
    }

    return data;
  };

  const acceptChallenge = async (challengeId: string) => {
    const { error } = await supabase
      .from("challenge_invites")
      .update({ status: "accepted" })
      .eq("id", challengeId);

    if (error) {
      console.error("Error accepting challenge:", error);
      return false;
    }

    return true;
  };

  const declineChallenge = async (challengeId: string) => {
    const { error } = await supabase
      .from("challenge_invites")
      .update({ status: "declined" })
      .eq("id", challengeId);

    if (error) {
      console.error("Error declining challenge:", error);
      return false;
    }

    return true;
  };

  const cancelChallenge = async (challengeId: string) => {
    const { error } = await supabase
      .from("challenge_invites")
      .update({ status: "expired" })
      .eq("id", challengeId);

    if (error) {
      console.error("Error canceling challenge:", error);
      return false;
    }

    return true;
  };

  return {
    incomingChallenges,
    outgoingChallenges,
    loading,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    refetch: fetchChallenges,
  };
};
