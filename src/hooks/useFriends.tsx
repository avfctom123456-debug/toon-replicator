import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  friend_username?: string;
  requester_username?: string;
}

export const useFriends = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    // Get all friend relationships
    const { data, error } = await supabase
      .from("friends")
      .select("*")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) {
      console.error("Error fetching friends:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setFriends([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    // Get all user IDs we need profiles for
    const userIds = new Set<string>();
    data.forEach((f) => {
      userIds.add(f.user_id);
      userIds.add(f.friend_id);
    });

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", Array.from(userIds));

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

    const enrichedData = data.map((f) => ({
      ...f,
      friend_username: profileMap.get(f.user_id === user.id ? f.friend_id : f.user_id),
      requester_username: profileMap.get(f.user_id),
    }));

    // Accepted friends
    setFriends(enrichedData.filter((f) => f.status === "accepted"));
    
    // Pending requests where current user is the recipient
    setPendingRequests(enrichedData.filter((f) => f.status === "pending" && f.friend_id === user.id));
    
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFriends();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("friends-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friends" },
        () => fetchFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFriends]);

  const sendFriendRequest = async (friendUserId: string) => {
    if (!user) return false;

    const { error } = await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: friendUserId,
      status: "pending",
    });

    if (error) {
      console.error("Error sending friend request:", error);
      return false;
    }

    await fetchFriends();
    return true;
  };

  const acceptFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) {
      console.error("Error accepting friend request:", error);
      return false;
    }

    await fetchFriends();
    return true;
  };

  const declineFriendRequest = async (friendshipId: string) => {
    const { error } = await supabase.from("friends").delete().eq("id", friendshipId);

    if (error) {
      console.error("Error declining friend request:", error);
      return false;
    }

    await fetchFriends();
    return true;
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase.from("friends").delete().eq("id", friendshipId);

    if (error) {
      console.error("Error removing friend:", error);
      return false;
    }

    await fetchFriends();
    return true;
  };

  const blockUser = async (friendUserId: string) => {
    if (!user) return false;

    // Check if relationship exists
    const { data: existing } = await supabase
      .from("friends")
      .select("id")
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUserId}),and(user_id.eq.${friendUserId},friend_id.eq.${user.id})`)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("friends")
        .update({ status: "blocked" })
        .eq("id", existing.id);
      if (error) return false;
    } else {
      const { error } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: friendUserId,
        status: "blocked",
      });
      if (error) return false;
    }

    await fetchFriends();
    return true;
  };

  const isFriend = (userId: string): boolean => {
    return friends.some(
      (f) => (f.user_id === userId || f.friend_id === userId) && f.status === "accepted"
    );
  };

  return {
    friends,
    pendingRequests,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    isFriend,
    refetch: fetchFriends,
  };
};
