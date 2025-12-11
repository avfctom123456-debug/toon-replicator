import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ClickableUsername } from "@/components/ClickableUsername";
import { useGlobalChat } from "@/hooks/useGlobalChat";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { 
  MessageCircle, 
  X, 
  Send, 
  Trash2, 
  Ban,
  Minimize2,
  Maximize2
} from "lucide-react";
import { format } from "date-fns";

interface GlobalChatProps {
  channel?: string;
}

export const GlobalChat = ({ channel = "global" }: GlobalChatProps) => {
  const { user } = useAuth();
  const { isAdmin, isModerator } = useUserRole();
  const { messages, loading, isBanned, sendMessage, deleteMessage } = useGlobalChat(channel);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track unread messages
  const hasUnread = !isOpen && messages.length > lastSeenCount;

  // Update last seen count when chat is opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setLastSeenCount(messages.length);
    }
  }, [isOpen, isMinimized, messages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isOpen && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    // Validate message length
    if (newMessage.length > 500) {
      toast.error("Message is too long (max 500 characters)");
      return;
    }

    setSending(true);
    const success = await sendMessage(newMessage);
    
    if (success) {
      setNewMessage("");
    } else {
      toast.error("Failed to send message");
    }
    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const success = await deleteMessage(messageId);
    if (success) {
      toast.success("Message deleted");
    } else {
      toast.error("Failed to delete message");
    }
  };

  const canModerate = isAdmin || isModerator;

  if (!user) return null;

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 relative ${
            hasUnread ? "ring-2 ring-offset-2 ring-offset-background ring-destructive" : ""
          }`}
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-[10px] text-destructive-foreground font-bold">
                {Math.min(messages.length - lastSeenCount, 9)}
                {messages.length - lastSeenCount > 9 ? '+' : ''}
              </span>
            </span>
          )}
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-xl transition-all duration-200 ${
            isMinimized ? "w-72 h-12" : "w-80 sm:w-96 h-[28rem]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30 rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">Global Chat</span>
              <Badge variant="secondary" className="text-xs">
                {messages.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="h-[20rem] p-3" ref={scrollRef}>
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-muted-foreground text-sm animate-pulse">Loading...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-muted-foreground text-sm">No messages yet. Start the conversation!</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isOwnMessage = msg.user_id === user.id;
                      return (
                        <div
                          key={msg.id}
                          className={`group flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <ClickableUsername
                              userId={msg.user_id}
                              username={msg.username}
                              className={`text-xs font-medium ${isOwnMessage ? "text-primary" : "text-muted-foreground"}`}
                            />
                            <span className="text-xs text-muted-foreground/60">
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div
                              className={`max-w-[14rem] px-3 py-2 rounded-lg text-sm break-words ${
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary/50 text-foreground"
                              }`}
                            >
                              {msg.message}
                            </div>
                            {/* Moderation controls */}
                            {canModerate && !isOwnMessage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                onClick={() => handleDeleteMessage(msg.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-border">
                {isBanned ? (
                  <div className="flex items-center justify-center gap-2 text-destructive text-sm py-2">
                    <Ban className="h-4 w-4" />
                    <span>You are banned from chat</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                      maxLength={500}
                      className="flex-1 text-sm"
                      disabled={sending}
                    />
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
