import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Search, Shield, RefreshCw, Eye, EyeOff, Ban, UserX, UserCheck } from "lucide-react";
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

interface ChatBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  username?: string;
  banned_by_username?: string;
}

export function ChatModerationPanel() {
  const { user } = useAuth();
  const { isAdmin, isModerator } = useUserRole();
  const [messages, setMessages] = useState<ModMessage[]>([]);
  const [bans, setBans] = useState<ChatBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [bansLoading, setBansLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [banSearch, setBanSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("messages");
  
  // Ban form state
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");

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

  const fetchBans = useCallback(async () => {
    if (!canModerate) return;
    
    setBansLoading(true);
    
    const { data, error } = await supabase
      .from("chat_bans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bans:", error);
      setBansLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setBans([]);
      setBansLoading(false);
      return;
    }

    const userIds = [...new Set([
      ...data.map((b) => b.user_id),
      ...data.map((b) => b.banned_by),
    ])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

    const enriched = data.map((b) => ({
      ...b,
      username: profileMap.get(b.user_id) || "Unknown",
      banned_by_username: profileMap.get(b.banned_by) || "Unknown",
    }));

    setBans(enriched);
    setBansLoading(false);
  }, [canModerate]);

  useEffect(() => {
    if (open && canModerate) {
      fetchAllMessages();
      fetchBans();
    }
  }, [open, canModerate, fetchAllMessages, fetchBans]);

  const filteredMessages = messages.filter((m) => {
    const matchesSearch =
      m.message.toLowerCase().includes(search.toLowerCase()) ||
      m.username?.toLowerCase().includes(search.toLowerCase());
    const matchesDeleted = showDeleted || !m.is_deleted;
    return matchesSearch && matchesDeleted;
  });

  const filteredBans = bans.filter((b) => {
    return b.username?.toLowerCase().includes(banSearch.toLowerCase()) ||
           b.reason?.toLowerCase().includes(banSearch.toLowerCase());
  });

  const activeBans = filteredBans.filter((b) => !b.expires_at || new Date(b.expires_at) > new Date());
  const expiredBans = filteredBans.filter((b) => b.expires_at && new Date(b.expires_at) <= new Date());

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

  const banUserFromMessage = async (userId: string, username: string) => {
    setBanUserId(userId);
    setBanReason("");
    setBanDuration("permanent");
    setActiveTab("bans");
  };

  const submitBan = async () => {
    if (!user || !banUserId) return;

    let expiresAt: string | null = null;
    if (banDuration !== "permanent") {
      const hours = parseInt(banDuration);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supabase.from("chat_bans").insert({
      user_id: banUserId,
      banned_by: user.id,
      reason: banReason || null,
      expires_at: expiresAt,
    });

    if (error) {
      toast.error("Failed to ban user");
      return;
    }

    toast.success("User banned from chat");
    setBanUserId("");
    setBanReason("");
    setBanDuration("permanent");
    fetchBans();
  };

  const unbanUser = async (banId: string) => {
    const { error } = await supabase.from("chat_bans").delete().eq("id", banId);

    if (error) {
      toast.error("Failed to unban user");
      return;
    }

    toast.success("User unbanned");
    fetchBans();
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="messages" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="bans" className="gap-2">
              <Ban className="h-4 w-4" />
              Bans ({activeBans.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            {/* Message Controls */}
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
            <ScrollArea className="h-[350px] border rounded-md">
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
                      <div className="flex gap-1">
                        {!msg.is_deleted && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteSingle(msg.id)}
                              title="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-orange-500 hover:text-orange-600"
                              onClick={() => banUserFromMessage(msg.user_id, msg.username || "")}
                              title="Ban user"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="bans" className="space-y-4">
            {/* Ban Form */}
            {banUserId && (
              <div className="p-4 border rounded-md bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <UserX className="h-4 w-4" />
                  Ban User
                </h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Reason (optional)"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                  <Select value={banDuration} onValueChange={setBanDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                      <SelectItem value="permanent">Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={submitBan} className="gap-2" variant="destructive">
                      <Ban className="h-4 w-4" />
                      Ban
                    </Button>
                    <Button variant="ghost" onClick={() => setBanUserId("")}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Ban Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bans..."
                  value={banSearch}
                  onChange={(e) => setBanSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchBans} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>

            {/* Active Bans */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-destructive">Active Bans ({activeBans.length})</h4>
              <ScrollArea className="h-[150px] border rounded-md">
                {bansLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : activeBans.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No active bans</div>
                ) : (
                  <div className="divide-y">
                    {activeBans.map((ban) => (
                      <div key={ban.id} className="p-3 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{ban.username}</span>
                            <Badge variant="destructive" className="text-xs">
                              {ban.expires_at ? `Until ${format(new Date(ban.expires_at), "MMM d, h:mm a")}` : "Permanent"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Banned by {ban.banned_by_username} on {format(new Date(ban.created_at), "MMM d, yyyy")}
                            {ban.reason && ` • Reason: ${ban.reason}`}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unbanUser(ban.id)}
                          className="gap-2"
                        >
                          <UserCheck className="h-4 w-4" />
                          Unban
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Ban History */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Ban History ({expiredBans.length})</h4>
              <ScrollArea className="h-[120px] border rounded-md">
                {expiredBans.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No expired bans</div>
                ) : (
                  <div className="divide-y">
                    {expiredBans.map((ban) => (
                      <div key={ban.id} className="p-3 opacity-60">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{ban.username}</span>
                          <Badge variant="secondary" className="text-xs">
                            Expired {format(new Date(ban.expires_at!), "MMM d, yyyy")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Banned by {ban.banned_by_username}
                          {ban.reason && ` • Reason: ${ban.reason}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}