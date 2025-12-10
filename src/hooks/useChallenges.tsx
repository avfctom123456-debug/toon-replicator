import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    console.log("Could not play notification sound:", e);
  }
};

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

export const useChallenges = (onChallengeAccepted?: (matchId: string) => void) => {
  const { user } = useAuth();
  const [incomingChallenges, setIncomingChallenges] = useState<ChallengeInvite[]>([]);
  const [outgoingChallenges, setOutgoingChallenges] = useState<ChallengeInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptedMatchId, setAcceptedMatchId] = useState<string | null>(null);

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
        { event: "UPDATE", schema: "public", table: "challenge_invites" },
        async (payload) => {
          const updated = payload.new as ChallengeInvite;
          // If this is our outgoing challenge that was just accepted
          if (
            user &&
            updated.challenger_id === user.id &&
            updated.status === "accepted" &&
            updated.match_id
          ) {
            setAcceptedMatchId(updated.match_id);
            onChallengeAccepted?.(updated.match_id);
          }
          fetchChallenges();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "challenge_invites" },
        async (payload) => {
          const newChallenge = payload.new as ChallengeInvite;
          // If this is an incoming challenge for us, play sound
          if (user && newChallenge.challenged_id === user.id) {
            playNotificationSound();
          }
          fetchChallenges();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "challenge_invites" },
        () => fetchChallenges()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChallenges, user, onChallengeAccepted]);

  const sendChallenge = async (friendUserId: string, deckCardIds: number[]) => {
    if (!user) return null;

    // Get challenger's username
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .single();

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

    // Create notification for the challenged user
    await supabase.from("notifications").insert({
      user_id: friendUserId,
      type: "challenge_received",
      title: "Challenge Received!",
      message: `${profile?.username || "A player"} has challenged you to a match!`,
      data: { challenge_id: data.id, challenger_id: user.id },
    });

    return data;
  };

  const acceptChallenge = async (challengeId: string, accepterDeckCardIds: number[]): Promise<{ success: boolean; matchId?: string }> => {
    if (!user) return { success: false };

    // Get the challenge details first
    const { data: challenge, error: fetchError } = await supabase
      .from("challenge_invites")
      .select("*")
      .eq("id", challengeId)
      .single();

    if (fetchError || !challenge) {
      console.error("Error fetching challenge:", fetchError);
      return { success: false };
    }

    // Create the match
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .insert({
        player1_id: challenge.challenger_id,
        player2_id: user.id,
        player1_deck: challenge.challenger_deck,
        player2_deck: accepterDeckCardIds,
        phase: "loading",
        game_state: {},
        current_turn: challenge.challenger_id,
      })
      .select()
      .single();

    if (matchError || !match) {
      console.error("Error creating match:", matchError);
      return { success: false };
    }

    // Update the challenge with the match ID and status
    const { error: updateError } = await supabase
      .from("challenge_invites")
      .update({ 
        status: "accepted",
        match_id: match.id 
      })
      .eq("id", challengeId);

    if (updateError) {
      console.error("Error updating challenge:", updateError);
      // Try to clean up the match we created
      await supabase.from("matches").delete().eq("id", match.id);
      return { success: false };
    }

    return { success: true, matchId: match.id };
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
    acceptedMatchId,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    cancelChallenge,
    refetch: fetchChallenges,
  };
};
