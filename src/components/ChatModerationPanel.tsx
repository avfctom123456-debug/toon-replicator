import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Search, Shield, RefreshCw, Eye, EyeOff, Ban } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ModMessage {
  id: string;
  user_id: string;
  message: string;
  channel: string;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  created_at: string;
  username?: string;
  deleter_username?: string;
}

export function ChatModerationPanel() {
  const { user } = useAuth();
  const { isAdmin, isModerator } = useUserRole();
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const canModerate = isAdmin || isModerator;

  const fetchAllMessages = useCallback(async () => {
    if (!canModerate) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

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

    // Get all user IDs (message authors + deleters)
    const userIds = [...new Set([
      ...data.map((m) => m.user_id),
      ...data.filter((m) => m.deleted_by).map((m) => m.deleted_by!),
    ])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

    const enriched = data.map((m) => ({
      ...m,
      username: profileMap.get(m.user_id) || "Unknown",
      deleter_username: m.deleted_by ? profileMap.get(m.deleted_by) : undefined,
    }));

    setMessages(enriched);
    setLoading(false);
  }, [canModerate]);

  useEffect(() => {
    if (open && canModerate) {
      fetchAllMessages();
    }
  }, [open, canModerate, fetchAllMessages]);

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.message.toLowerCase().includes(search.toLowerCase()) ||
      m.username?.toLowerCase().includes(search.toLowerCase());
    const matchesDeleted = showDeleted || !m.is_deleted;
    return matchesSearch && matchesDeleted;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const nonDeletedIds = filteredMessages.filter((m) => !m.is_deleted).map((m) => m.id);
    setSelectedIds(new Set(nonDeletedIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const deleteSelected = async () => {
    if (!user || selectedIds.size === 0) return;

    const { error } = await supabase
      .from("chat_messages")
      .update({
        is_deleted: true,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
      })
      .in("id", Array.from(selectedIds));

    if (error) {
      toast.error("Failed to delete messages");
      return;
    }

    toast.success(`Deleted ${selectedIds.size} message(s)`);
    setSelectedIds(new Set());
    fetchAllMessages();
  };

  const deleteSingle = async (messageId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("chat_messages")
      .update({
        is_deleted: true,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
      return;
    }

    toast.success("Message deleted");
    fetchAllMessages();
  };

  if (!canModerate) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          Mod Panel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Chat Moderation Panel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages or users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleted(!showDeleted)}
              className="gap-2"
            >
              {showDeleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showDeleted ? "Showing Deleted" : "Hiding Deleted"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchAllMessages} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete {selectedIds.size} Selected
              </Button>
            )}
            <span className="text-muted-foreground ml-auto">
              {filteredMessages.length} messages
            </span>
          </div>

          {/* Message List */}
          <ScrollArea className="h-[400px] border rounded-md">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredMessages.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No messages found</div>
            ) : (
              <div className="divide-y">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 flex items-start gap-3 ${
                      msg.is_deleted ? "bg-destructive/10 opacity-60" : ""
                    }`}
                  >
                    {!msg.is_deleted && (
                      <Checkbox
                        checked={selectedIds.has(msg.id)}
                        onCheckedChange={() => toggleSelect(msg.id)}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{msg.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), "MMM d, h:mm a")}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          #{msg.channel}
                        </Badge>
                        {msg.is_deleted && (
                          <Badge variant="destructive" className="text-xs">
                            Deleted by {msg.deleter_username || "Unknown"}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-sm mt-1 break-words ${msg.is_deleted ? "line-through" : ""}`}>
                        {msg.message}
                      </p>
                    </div>
                    {!msg.is_deleted && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteSingle(msg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}