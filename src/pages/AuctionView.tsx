import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAuctionBids, Auction, AuctionBid } from "@/hooks/useAuctions";
import { getCardById } from "@/lib/gameEngine";
import { MiniCard } from "@/components/MiniCard";
import { UrgentCountdown } from "@/components/auction/UrgentCountdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, Coins, TrendingUp, User, Send, Eye,
  Gavel, MessageCircle
} from "lucide-react";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface Viewer {
  odlfjasfd: string;
  odl_user_id: string;
  username: string;
  online_at: string;
}

export default function AuctionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { bids } = useAuctionBids(id || null);
  
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState(0);
  const [now, setNow] = useState(Date.now());
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Presence state
  const [viewers, setViewers] = useState<Map<string, { username: string; online_at: string }>>(new Map());
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("Error fetching auction:", error);
      toast.error("Auction not found");
      navigate("/trade-board");
      return;
    }

    // Fetch usernames
    const userIds = [data.user_id];
    if (data.highest_bidder_id) userIds.push(data.highest_bidder_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const usernameMap = new Map(
      (profiles || []).map(p => [p.user_id, p.username])
    );

    // Fetch copy number if applicable
    let copyNumber = null;
    if (data.user_card_id) {
      const { data: userCard } = await supabase
        .from("user_cards")
        .select("copy_number")
        .eq("id", data.user_card_id)
        .single();
      copyNumber = userCard?.copy_number;
    }

    setAuction({
      ...data,
      seller_username: usernameMap.get(data.user_id) || "Unknown",
      highest_bidder_username: data.highest_bidder_id 
        ? usernameMap.get(data.highest_bidder_id) || "Unknown"
        : null,
      copy_number: copyNumber,
    });

    // Set initial bid amount
    const minBid = data.current_bid > 0 
      ? Math.ceil(data.current_bid * 1.05) 
      : data.starting_bid;
    setBidAmount(minBid);
    setLoading(false);
  }, [id, navigate]);

  // Timer for countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!id || !user || !profile) return;

    fetchAuction();

    // Subscribe to auction updates
    const auctionChannel = supabase
      .channel(`auction-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions", filter: `id=eq.${id}` },
        () => {
          fetchAuction();
        }
      )
      .subscribe();

    // Setup presence and chat channel
    const presenceChannel = supabase.channel(`auction-room-${id}`, {
      config: { presence: { key: user.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const newViewers = new Map<string, { username: string; online_at: string }>();
        
        Object.entries(state).forEach(([key, presences]) => {
          const presence = (presences as any[])[0];
          if (presence) {
            newViewers.set(key, {
              username: presence.username,
              online_at: presence.online_at,
            });
          }
        });
        
        setViewers(newViewers);
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload as ChatMessage]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            username: profile.username,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(auctionChannel);
      presenceChannel.unsubscribe();
    };
  }, [id, user, profile, fetchAuction]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const formatTimeLeft = (endsAt: string) => {
    const endTime = new Date(endsAt).getTime();
    const diff = endTime - now;
    
    if (diff <= 0) return "Ended";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const isAuctionEnded = (endsAt: string) => {
    return new Date(endsAt).getTime() <= now;
  };

  const handlePlaceBid = async () => {
    if (!auction || !id) return;

    const minBid = auction.current_bid > 0 
      ? Math.ceil(auction.current_bid * 1.05)
      : auction.starting_bid;

    if (bidAmount < minBid) {
      toast.error(`Minimum bid is ${minBid} coins`);
      return;
    }

    const { data, error } = await supabase.rpc("place_bid", {
      p_auction_id: id,
      p_bid_amount: bidAmount,
    });

    if (error) {
      console.error("Error placing bid:", error);
      toast.error(error.message);
      return;
    }

    const result = data as { success: boolean; error?: string };
    if (result.success) {
      toast.success(`Bid of ${bidAmount} coins placed!`);
      refetchProfile();
      fetchAuction();
    } else {
      toast.error(result.error || "Failed to place bid");
    }
  };

  const handleEndAuction = async () => {
    if (!id) return;

    const { data, error } = await supabase.rpc("end_auction", {
      p_auction_id: id,
    });

    if (error) {
      console.error("Error ending auction:", error);
      toast.error(error.message);
      return;
    }

    const result = data as { success: boolean; error?: string };
    if (result.success) {
      toast.success("Auction finalized!");
      refetchProfile();
      navigate("/trade-board");
    } else {
      toast.error(result.error || "Failed to end auction");
    }
  };

  const sendChatMessage = () => {
    if (!newMessage.trim() || !channelRef.current || !user || !profile) return;

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: profile.username,
      message: newMessage.trim(),
      timestamp: Date.now(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: chatMessage,
    });

    setChatMessages(prev => [...prev, chatMessage]);
    setNewMessage("");
  };

  if (loading || !auction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading auction...</div>
      </div>
    );
  }

  const card = getCardById(auction.card_id);
  if (!card) {
    navigate("/trade-board");
    return null;
  }

  const isOwner = auction.user_id === user?.id;
  const isHighestBidder = auction.highest_bidder_id === user?.id;
  const ended = isAuctionEnded(auction.ends_at);
  const minBid = auction.current_bid > 0 
    ? Math.ceil(auction.current_bid * 1.05)
    : auction.starting_bid;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/trade-board")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Trade Board
          </Button>
          <div className="flex items-center gap-3 text-foreground">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="font-bold">{profile?.coins || 0}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Auction Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Card Display */}
                  <div className="flex-shrink-0 flex justify-center">
                    <MiniCard card={card} size="md" copyNumber={auction.copy_number} />
                  </div>

                  {/* Auction Details */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">
                        {card.title}
                        {auction.copy_number && (
                          <span className={`ml-2 text-lg ${
                            auction.copy_number <= 10 ? "text-yellow-500" :
                            auction.copy_number <= 50 ? "text-gray-400" : "text-muted-foreground"
                          }`}>
                            #{auction.copy_number}
                          </span>
                        )}
                      </h1>
                      <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <User className="h-4 w-4" />
                        Seller: {auction.seller_username}
                      </div>
                    </div>

                    {/* Timer */}
                    <UrgentCountdown endsAt={auction.ends_at} now={now} />

                    {/* Current Bid */}
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Current Bid</div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-green-500" />
                        <span className="text-3xl font-bold text-yellow-500">
                          {auction.current_bid > 0 ? auction.current_bid : auction.starting_bid}
                        </span>
                        <Coins className="h-6 w-6 text-yellow-500" />
                      </div>
                      {auction.highest_bidder_username && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Highest bidder: <span className={isHighestBidder ? "text-green-500 font-bold" : ""}>
                            {auction.highest_bidder_username}
                            {isHighestBidder && " (You!)"}
                          </span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Minimum next bid: {minBid} coins (+5%)
                      </div>
                    </div>

                    {/* Bid Actions */}
                    {!ended && !isOwner && (
                      <div className="flex gap-3">
                        <Input
                          type="number"
                          value={bidAmount}
                          onChange={(e) => setBidAmount(parseInt(e.target.value) || minBid)}
                          min={minBid}
                          className="w-32"
                        />
                        <Button 
                          onClick={handlePlaceBid}
                          disabled={bidAmount < minBid}
                          className="flex-1"
                        >
                          <Gavel className="mr-2 h-4 w-4" />
                          Place Bid
                        </Button>
                      </div>
                    )}

                    {isOwner && ended && (
                      <Button onClick={handleEndAuction} className="w-full">
                        Finalize Auction
                      </Button>
                    )}

                    {ended && isHighestBidder && !isOwner && (
                      <div className="text-center text-green-500 font-bold py-4 bg-green-500/10 rounded-lg">
                        You won! Waiting for seller to finalize.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bid History */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Bid History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bids.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No bids yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {bids.map((bid, index) => (
                      <div 
                        key={bid.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? "bg-green-500/10 border border-green-500/30" : "bg-background/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className={bid.user_id === user?.id ? "text-primary font-bold" : ""}>
                            {bid.username}
                          </span>
                          {index === 0 && <span className="text-xs text-green-500">(Highest)</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-yellow-500">{bid.bid_amount}</span>
                          <Coins className="h-4 w-4 text-yellow-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Viewers & Chat */}
          <div className="space-y-6">
            {/* Viewers */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" />
                  Watching ({viewers.size})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Array.from(viewers.entries()).map(([userId, viewer]) => (
                    <div 
                      key={userId}
                      className={`px-3 py-1 rounded-full text-sm ${
                        userId === user?.id 
                          ? "bg-primary/20 text-primary" 
                          : "bg-background/50 text-foreground"
                      }`}
                    >
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
                      {viewer.username}
                      {userId === user?.id && " (you)"}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-4 w-4" />
                  Live Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-80 px-4" ref={chatScrollRef}>
                  {chatMessages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-sm">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    <div className="space-y-3 py-2">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="text-sm">
                          <span className={`font-bold ${
                            msg.userId === user?.id ? "text-primary" : "text-foreground"
                          }`}>
                            {msg.username}:
                          </span>
                          <span className="text-muted-foreground ml-2">{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2 p-4 border-t border-border">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={sendChatMessage} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
