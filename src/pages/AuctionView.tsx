import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAuctionBids, Auction, AuctionBid } from "@/hooks/useAuctions";
import { useCardOverrides } from "@/hooks/useCardOverrides";
import { getCardById } from "@/lib/gameEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, Coins, Send, Gavel
} from "lucide-react";

const IMAGE_BASE_URL = "https://dlgjmqnjzepntvfeqfcx.supabase.co/storage/v1/object/public/card-images";

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export default function AuctionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { bids } = useAuctionBids(id || null);
  const { getOverride } = useCardOverrides();
  
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
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

  const getTimeComponents = (endsAt: string) => {
    const endTime = new Date(endsAt).getTime();
    const diff = Math.max(0, endTime - now);
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds, ended: diff <= 0 };
  };

  const handlePlaceBid = async () => {
    if (!auction || !id) return;

    const minBid = auction.current_bid > 0 
      ? Math.ceil(auction.current_bid * 1.05)
      : auction.starting_bid;

    const { data, error } = await supabase.rpc("place_bid", {
      p_auction_id: id,
      p_bid_amount: minBid,
    });

    if (error) {
      console.error("Error placing bid:", error);
      toast.error(error.message);
      return;
    }

    const result = data as { success: boolean; error?: string };
    if (result.success) {
      toast.success(`Bid of ${minBid} coins placed!`);
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
      <div className="min-h-screen bg-gradient-to-br from-[hsl(200,60%,20%)] via-[hsl(210,50%,25%)] to-[hsl(220,40%,15%)] flex items-center justify-center">
        <div className="text-white text-xl font-bold">Loading auction...</div>
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
  const time = getTimeComponents(auction.ends_at);
  const minBid = auction.current_bid > 0 
    ? Math.ceil(auction.current_bid * 1.05)
    : auction.starting_bid;
  const currentBid = auction.current_bid > 0 ? auction.current_bid : auction.starting_bid;

  const customImageUrl = getOverride(auction.card_id)?.custom_image_url;
  const imageUrl = customImageUrl || `${IMAGE_BASE_URL}/${card.id}.jpg`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(200,60%,20%)] via-[hsl(210,50%,25%)] to-[hsl(220,40%,15%)] p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/trade-board")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            BACK TO AUCTIONS
          </Button>
          
          {/* Time Remaining */}
          <div className="bg-gradient-to-b from-[hsl(200,40%,35%)] to-[hsl(210,50%,25%)] rounded-lg px-4 py-2 border border-[hsl(200,50%,40%)]">
            <div className="text-[hsl(200,20%,70%)] text-xs text-center mb-1 font-semibold">TIME REMAINING:</div>
            <div className="flex gap-2">
              <div className="text-center">
                <div className="bg-[hsl(0,70%,50%)] text-white font-bold text-xl px-3 py-1 rounded min-w-[40px]">
                  {String(time.days).padStart(2, '0')}
                </div>
                <div className="text-[hsl(200,20%,60%)] text-[10px] mt-1">DAY</div>
              </div>
              <div className="text-white text-xl font-bold self-start mt-1">:</div>
              <div className="text-center">
                <div className="bg-[hsl(0,70%,50%)] text-white font-bold text-xl px-3 py-1 rounded min-w-[40px]">
                  {String(time.hours).padStart(2, '0')}
                </div>
                <div className="text-[hsl(200,20%,60%)] text-[10px] mt-1">HRS</div>
              </div>
              <div className="text-white text-xl font-bold self-start mt-1">:</div>
              <div className="text-center">
                <div className="bg-[hsl(0,70%,50%)] text-white font-bold text-xl px-3 py-1 rounded min-w-[40px]">
                  {String(time.minutes).padStart(2, '0')}
                </div>
                <div className="text-[hsl(200,20%,60%)] text-[10px] mt-1">MIN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-[1fr,auto,280px] gap-4">
          {/* Left Panel - Bid Info */}
          <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,35%,75%)] rounded-lg p-4 shadow-lg">
            <div className="space-y-4">
              {/* High Bidder */}
              <div className="bg-white/60 rounded p-3">
                <div className="text-[hsl(210,30%,30%)] text-xs font-semibold mb-1">HIGH BIDDER:</div>
                <div className="text-[hsl(210,80%,40%)] font-bold text-lg">
                  {auction.highest_bidder_username || "No bids yet"}
                  {isHighestBidder && <span className="text-green-600 ml-2">(YOU!)</span>}
                </div>
              </div>

              {/* Current High Bid */}
              <div className="bg-white/60 rounded p-3">
                <div className="text-[hsl(210,30%,30%)] text-xs font-semibold mb-1">CURRENT HIGH BID:</div>
                <div className="text-[hsl(210,80%,40%)] font-bold text-xl flex items-center gap-2">
                  {currentBid.toLocaleString()} POINTS
                </div>
              </div>

              {/* Starting Price */}
              <div className="bg-white/60 rounded p-3">
                <div className="text-[hsl(210,30%,30%)] text-xs font-semibold mb-1">STARTING PRICE:</div>
                <div className="text-[hsl(210,80%,40%)] font-bold">
                  {auction.starting_bid.toLocaleString()} POINTS
                </div>
              </div>

              {/* Seller */}
              <div className="bg-white/60 rounded p-3">
                <div className="text-[hsl(210,30%,30%)] text-xs font-semibold mb-1">SELLER:</div>
                <div className="text-[hsl(210,80%,40%)] font-bold uppercase">
                  {auction.seller_username}
                </div>
              </div>

              {/* Bid Button */}
              {!time.ended && !isOwner && (
                <Button 
                  onClick={handlePlaceBid}
                  className="w-full bg-gradient-to-r from-[hsl(30,90%,50%)] to-[hsl(40,95%,55%)] hover:from-[hsl(30,90%,45%)] hover:to-[hsl(40,95%,50%)] text-white font-bold text-lg py-6 rounded-lg shadow-lg border-2 border-[hsl(30,80%,40%)]"
                >
                  <Gavel className="mr-2 h-5 w-5" />
                  BID NOW {minBid.toLocaleString()} POINTS
                </Button>
              )}

              {isOwner && time.ended && (
                <Button 
                  onClick={handleEndAuction} 
                  className="w-full bg-green-600 hover:bg-green-700 font-bold py-4"
                >
                  Finalize Auction
                </Button>
              )}

              {time.ended && isHighestBidder && !isOwner && (
                <div className="text-center text-green-700 font-bold py-4 bg-green-200 rounded-lg">
                  🎉 You won! Waiting for seller to finalize.
                </div>
              )}

              {time.ended && !isHighestBidder && !isOwner && (
                <div className="text-center text-red-700 font-bold py-4 bg-red-200 rounded-lg">
                  Auction Ended
                </div>
              )}

              {/* Help Link */}
              <button className="text-[hsl(210,80%,40%)] text-sm underline hover:no-underline w-full text-center">
                HELP
              </button>
            </div>
          </div>

          {/* Center - Card Display */}
          <div className="flex flex-col items-center justify-center">
            {/* Card with concentric circles background */}
            <div className="relative w-[280px] h-[280px] md:w-[340px] md:h-[340px] rounded-lg overflow-hidden border-4 border-[hsl(200,50%,40%)] shadow-2xl">
              {/* Concentric circles background */}
              <div className="absolute inset-0 bg-gradient-radial from-black via-[hsl(10,80%,30%)] to-[hsl(15,90%,45%)]" 
                style={{
                  background: `
                    radial-gradient(circle at center, 
                      black 0%, 
                      black 15%, 
                      hsl(10, 80%, 25%) 20%,
                      hsl(10, 85%, 35%) 30%,
                      hsl(15, 90%, 40%) 40%,
                      hsl(20, 90%, 45%) 50%,
                      hsl(15, 85%, 40%) 60%,
                      hsl(10, 80%, 35%) 70%,
                      hsl(10, 75%, 30%) 80%,
                      hsl(5, 70%, 25%) 90%,
                      hsl(0, 65%, 20%) 100%
                    )
                  `
                }}
              />
              
              {/* Card Image */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img 
                  src={imageUrl}
                  alt={card.title}
                  className="w-[140px] h-[140px] md:w-[180px] md:h-[180px] rounded-full object-cover border-4 border-black shadow-2xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${IMAGE_BASE_URL}/${card.id}.jpg`;
                  }}
                />
              </div>
            </div>

            {/* Card Name */}
            <div className="mt-4 bg-gradient-to-r from-[hsl(350,80%,55%)] to-[hsl(20,85%,55%)] px-6 py-3 rounded-lg shadow-lg">
              <div className="text-[hsl(200,20%,90%)] text-xs font-semibold mb-1">CARD NAME:</div>
              <div className="text-white font-bold text-xl uppercase tracking-wide">
                {card.title}
                {auction.copy_number && (
                  <span className={`ml-2 ${
                    auction.copy_number <= 10 ? "text-yellow-300" :
                    auction.copy_number <= 50 ? "text-gray-300" : "text-white/70"
                  }`}>
                    #{auction.copy_number}
                  </span>
                )}
              </div>
            </div>

            {/* Info icon */}
            <button className="mt-2 w-8 h-8 rounded-full bg-[hsl(210,80%,50%)] text-white flex items-center justify-center font-bold text-lg shadow-lg hover:bg-[hsl(210,80%,45%)]">
              i
            </button>
          </div>

          {/* Right Panel - Viewers & Chat */}
          <div className="flex flex-col gap-4 max-h-[600px]">
            {/* Who's Here */}
            <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,35%,75%)] rounded-lg overflow-hidden shadow-lg flex-shrink-0">
              <div className="bg-gradient-to-r from-[hsl(200,40%,60%)] to-[hsl(210,45%,55%)] px-3 py-2 flex items-center gap-2">
                <div className="w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">👤</span>
                </div>
                <span className="text-white font-bold text-sm">WHO'S HERE</span>
                <span className="ml-auto bg-[hsl(210,50%,40%)] text-white px-2 py-0.5 rounded text-xs font-bold">
                  {viewers.size}
                </span>
              </div>
              <ScrollArea className="h-[120px]">
                <div className="p-2 space-y-1">
                  {Array.from(viewers.entries()).map(([userId, viewer]) => (
                    <div 
                      key={userId}
                      className={`px-2 py-1 rounded text-sm font-medium ${
                        userId === user?.id 
                          ? "bg-[hsl(210,80%,50%)] text-white" 
                          : "text-[hsl(210,80%,40%)] hover:bg-white/50"
                      }`}
                    >
                      {viewer.username}
                      {userId === user?.id && " (you)"}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat */}
            <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,35%,75%)] rounded-lg overflow-hidden shadow-lg flex-1 flex flex-col min-h-[300px]">
              {/* Chat Messages */}
              <ScrollArea className="flex-1 p-3" ref={chatScrollRef}>
                {chatMessages.length === 0 ? (
                  <p className="text-[hsl(210,30%,50%)] text-center py-4 text-sm italic">
                    No messages yet...
                  </p>
                ) : (
                  <div className="space-y-2">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <span className={`font-bold ${
                          msg.userId === user?.id ? "text-[hsl(210,80%,50%)]" : "text-[hsl(210,80%,40%)]"
                        }`}>
                          {msg.username}:
                        </span>
                        <span className="text-[hsl(210,30%,30%)] ml-2">{msg.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-2 bg-white/30 border-t border-[hsl(200,30%,70%)]">
                <div className="text-[hsl(210,30%,40%)] text-xs mb-1 font-semibold">SELECT A MESSAGE TO CHAT</div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder="Type message..."
                    className="flex-1 bg-white border-[hsl(200,30%,60%)] text-[hsl(210,30%,20%)] text-sm"
                  />
                  <Button 
                    onClick={sendChatMessage}
                    size="sm"
                    className="bg-[hsl(210,80%,50%)] hover:bg-[hsl(210,80%,45%)] text-white font-bold px-4"
                  >
                    SEND
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bid History below */}
        <div className="mt-4 bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,35%,75%)] rounded-lg p-4 shadow-lg">
          <div className="text-[hsl(210,30%,30%)] font-bold mb-3">BID HISTORY ({bids.length} bids)</div>
          {bids.length === 0 ? (
            <p className="text-[hsl(210,30%,50%)] text-center py-4">No bids yet</p>
          ) : (
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {bids.slice(0, 10).map((bid, index) => (
                <div 
                  key={bid.id}
                  className={`flex items-center justify-between px-3 py-2 rounded ${
                    index === 0 
                      ? "bg-yellow-200 border border-yellow-400" 
                      : "bg-white/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      index === 0 ? "bg-yellow-500 text-white" : "bg-[hsl(210,30%,70%)] text-white"
                    }`}>
                      {index === 0 ? "👑" : index + 1}
                    </span>
                    <span className={`font-medium ${
                      bid.user_id === user?.id ? "text-[hsl(210,80%,50%)]" : "text-[hsl(210,30%,30%)]"
                    }`}>
                      {bid.username}
                      {bid.user_id === user?.id && " (you)"}
                    </span>
                  </div>
                  <span className="font-bold text-[hsl(210,80%,40%)]">
                    {bid.bid_amount.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
