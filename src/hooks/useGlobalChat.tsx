import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  channel: string;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  created_at: string;
  username?: string;
}

export interface ChatBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export const useGlobalChat = (channel: string = "global") => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("channel", channel)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching messages:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setMessages([]);
      setLoading(false);
      return;
    }

    // Get usernames
    const userIds = [...new Set(data.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

    const enriched = data.map((m) => ({
      ...m,
      username: profileMap.get(m.user_id) || "Unknown",
    }));

    setMessages(enriched);
    setLoading(false);
  }, [channel]);

  const checkBan = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("chat_bans")
      .select("*")
      .eq("user_id", user.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .single();

    setIsBanned(!!data);
  }, [user]);

  useEffect(() => {
    fetchMessages();
    checkBan();

    // Subscribe to new messages
    const channel_sub = supabase
      .channel(`chat-${channel}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${channel}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          // Fetch username for new message
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", newMsg.user_id)
            .single();

          setMessages((prev) => [
            ...prev,
            { ...newMsg, username: profile?.username || "Unknown" },
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel=eq.${channel}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          if (updated.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel_sub);
    };
  }, [channel, fetchMessages, checkBan]);

  const sendMessage = async (messageText: string) => {
    if (!user || isBanned) return false;

    const { error } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      message: messageText.trim(),
      channel,
    });

    if (error) {
      console.error("Error sending message:", error);
      return false;
    }

    return true;
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return false;

    const { error } = await supabase
      .from("chat_messages")
      .update({
        is_deleted: true,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (error) {
      console.error("Error deleting message:", error);
      return false;
    }

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    return true;
  };

  const banUser = async (userId: string, reason?: string, expiresAt?: Date) => {
    if (!user) return false;

    const { error } = await supabase.from("chat_bans").insert({
      user_id: userId,
      banned_by: user.id,
      reason: reason || null,
      expires_at: expiresAt?.toISOString() || null,
    });

    if (error) {
      console.error("Error banning user:", error);
      return false;
    }

    return true;
  };

  const unbanUser = async (banId: string) => {
    const { error } = await supabase.from("chat_bans").delete().eq("id", banId);

    if (error) {
      console.error("Error unbanning user:", error);
      return false;
    }

    return true;
  };

  return {
    messages,
    loading,
    isBanned,
    sendMessage,
    deleteMessage,
    banUser,
    unbanUser,
    refetch: fetchMessages,
  };
};
