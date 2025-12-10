import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useAuctionBids, Auction } from "@/hooks/useAuctions";
import { useCardOverrides } from "@/hooks/useCardOverrides";
import { getCardById } from "@/lib/gameEngine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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
  const [chatVisible, setChatVisible] = useState(true);
  const [showCardInfo, setShowCardInfo] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [viewers, setViewers] = useState<Map<string, { username: string; online_at: string }>>(new Map());
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchAuction = useCallback(async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Auction not found");
      navigate("/trade-board");
      return;
    }

    const userIds = [data.user_id];
    if (data.highest_bidder_id) userIds.push(data.highest_bidder_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const usernameMap = new Map(
      (profiles || []).map(p => [p.user_id, p.username])
    );

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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id || !user || !profile) return;

    fetchAuction();

    const auctionChannel = supabase
      .channel(`auction-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions", filter: `id=eq.${id}` },
        () => { fetchAuction(); }
      )
      .subscribe();

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
      <div className="min-h-screen bg-[#1a3a4a] flex items-center justify-center">
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
    <div 
      className="min-h-screen p-4"
      style={{
        background: 'linear-gradient(135deg, #1a5a6a 0%, #2a7a8a 25%, #3a8a9a 50%, #2a7a8a 75%, #1a5a6a 100%)'
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg relative">
              <div className="absolute w-16 h-4 border-2 border-cyan-300 rounded-full -rotate-12 opacity-60"></div>
              <div className="w-6 h-6 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full"></div>
            </div>
            <div>
              <div className="text-cyan-200 font-bold text-sm tracking-wide">GET CARDS</div>
              <div className="text-white font-black text-2xl tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                AUCTION ZONE
              </div>
            </div>
          </div>
          
          {/* Points Display */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-700 rounded px-3 py-1">
            <span className="text-yellow-300 font-bold">{profile?.coins?.toLocaleString() || 0}</span>
            <span className="text-cyan-200 text-sm">POINTS TO SPEND</span>
          </div>
        </div>

        {/* Back to Auctions + Time Remaining */}
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={() => navigate("/trade-board")}
            className="text-cyan-200 hover:text-white font-semibold text-sm underline"
          >
            BACK TO AUCTIONS
          </button>
          
          {/* Time Remaining Box */}
          <div className="bg-gradient-to-b from-[#2a5a6a] to-[#1a4a5a] rounded-lg px-4 py-2 border border-cyan-600">
            <div className="text-cyan-300 text-[10px] text-center font-bold mb-1">TIME REMAINING:</div>
            <div className="flex gap-1 items-center">
              <div className="text-center">
                <div className="bg-[#cc3333] text-white font-black text-xl px-2 py-0.5 rounded min-w-[32px]">
                  {String(time.days).padStart(2, '0')}
                </div>
                <div className="text-cyan-400 text-[8px] mt-0.5">DAY</div>
              </div>
              <span className="text-white font-bold">:</span>
              <div className="text-center">
                <div className="bg-[#cc3333] text-white font-black text-xl px-2 py-0.5 rounded min-w-[32px]">
                  {String(time.hours).padStart(2, '0')}
                </div>
                <div className="text-cyan-400 text-[8px] mt-0.5">HRS</div>
              </div>
              <span className="text-white font-bold">:</span>
              <div className="text-center">
                <div className="bg-[#cc3333] text-white font-black text-xl px-2 py-0.5 rounded min-w-[32px]">
                  {String(time.minutes).padStart(2, '0')}
                </div>
                <div className="text-cyan-400 text-[8px] mt-0.5">MIN</div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] rounded-lg p-4 shadow-xl">
          {/* Top Row: Left Info + BID NOW Button */}
          <div className="grid grid-cols-[200px,1fr] gap-4 mb-4">
            {/* Left Panel - Bid Info */}
            <div className="space-y-2">
              <div className="bg-white/70 rounded p-2 border border-[#8aa8b8]">
                <div className="text-[#4a6a7a] text-[10px] font-bold">HIGH BIDDER:</div>
                <div className="text-[#2266aa] font-black text-sm uppercase truncate">
                  {auction.highest_bidder_username || "NO BIDS YET"}
                </div>
              </div>

              <div className="bg-white/70 rounded p-2 border border-[#8aa8b8]">
                <div className="text-[#4a6a7a] text-[10px] font-bold">CURRENT HIGH BID:</div>
                <div className="text-[#2266aa] font-black text-sm">
                  {currentBid.toLocaleString()} POINTS
                </div>
              </div>

              <div className="bg-white/70 rounded p-2 border border-[#8aa8b8]">
                <div className="text-[#4a6a7a] text-[10px] font-bold">STARTING PRICE:</div>
                <div className="text-[#2266aa] font-black text-sm">
                  {auction.starting_bid.toLocaleString()} POINTS
                </div>
              </div>

              <div className="bg-white/70 rounded p-2 border border-[#8aa8b8]">
                <div className="text-[#4a6a7a] text-[10px] font-bold">SELLER:</div>
                <div className="text-[#2266aa] font-black text-sm uppercase truncate">
                  {auction.seller_username}
                </div>
              </div>

              <button className="text-[#2266aa] text-xs font-bold underline hover:no-underline w-full text-center">
                HELP
              </button>
            </div>

            {/* BID NOW Button */}
            <div className="flex items-center justify-center">
              {!time.ended && !isOwner ? (
                <button 
                  onClick={handlePlaceBid}
                  className="bg-gradient-to-b from-[#ff8833] to-[#cc5500] hover:from-[#ffaa55] hover:to-[#dd6600] text-white font-black text-3xl py-4 px-12 rounded-lg shadow-lg border-2 border-[#aa4400] transition-all"
                  style={{ textShadow: '2px 2px 2px rgba(0,0,0,0.5)' }}
                >
                  BID NOW&nbsp;&nbsp;{minBid.toLocaleString()} POINTS
                </button>
              ) : isOwner && time.ended ? (
                <Button 
                  onClick={handleEndAuction}
                  className="bg-green-600 hover:bg-green-700 font-bold py-6 px-12 text-xl"
                >
                  FINALIZE AUCTION
                </Button>
              ) : time.ended && isHighestBidder ? (
                <div className="bg-green-200 border-2 border-green-500 rounded-lg p-6 text-center">
                  <div className="text-green-800 font-black text-2xl">🎉 YOU WON!</div>
                  <div className="text-green-700">Waiting for seller to finalize</div>
                </div>
              ) : time.ended ? (
                <div className="bg-red-200 border-2 border-red-400 rounded-lg p-6 text-center">
                  <div className="text-red-800 font-black text-2xl">AUCTION ENDED</div>
                </div>
              ) : (
                <div className="text-[#4a6a7a] text-center font-bold text-lg">
                  This is your auction
                </div>
              )}
            </div>
          </div>

          {/* Card Display - Large Rectangle with Card Name Top Left */}
          <div className="relative mb-4">
            {/* Card Name Banner - Top Left */}
            <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-[#cc3344] via-[#dd5544] to-[#ee7744] rounded-lg px-4 py-2 border-2 border-[#aa2233] shadow-lg">
              <div className="text-[#ffddcc] text-[10px] font-bold">CARD NAME:</div>
              <div className="text-white font-black text-lg uppercase" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
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

            {/* Info Button - Top Right */}
            <button 
              onClick={() => setShowCardInfo(true)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-[#3388cc] hover:bg-[#44aaee] text-white rounded-full font-bold text-lg shadow-lg flex items-center justify-center"
            >
              i
            </button>

            {/* Card Background with concentric circles */}
            <div 
              onClick={() => setShowCardInfo(true)}
              className="w-full h-[300px] md:h-[400px] rounded-lg overflow-hidden border-4 border-[#3388bb] shadow-xl cursor-pointer"
              style={{
                background: `radial-gradient(circle at center, 
                  #000000 0%, 
                  #000000 15%, 
                  #661111 20%,
                  #882222 25%,
                  #aa3333 30%,
                  #cc4444 35%,
                  #dd5544 40%,
                  #ee6644 45%,
                  #ff7755 50%,
                  #ee6644 55%,
                  #dd5544 60%,
                  #cc4444 65%,
                  #aa3333 70%,
                  #882222 75%,
                  #661111 80%,
                  #441111 85%,
                  #331111 90%
                )`
              }}
            >
              {/* Card Image - Centered and Large */}
              <div className="w-full h-full flex items-center justify-center">
                <img 
                  src={imageUrl}
                  alt={card.title}
                  className="max-w-[50%] max-h-[70%] object-contain drop-shadow-2xl"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `${IMAGE_BASE_URL}/${card.id}.jpg`;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Section - Who's Here + Chat */}
          <div className="grid grid-cols-[140px,1fr,60px] gap-2">
            {/* Who's Here */}
            <div className="bg-gradient-to-b from-[#d8e8f0] to-[#b8d0e0] rounded border border-[#8aa8b8]">
              <div className="bg-gradient-to-r from-[#6090a0] to-[#7aa0b0] px-2 py-1 flex items-center gap-1">
                <div className="w-5 h-5 bg-pink-300 rounded-full flex items-center justify-center text-[10px]">
                  👤
                </div>
                <span className="text-white font-bold text-[10px]">WHO'S HERE</span>
                <span className="ml-auto bg-[#4a7a8a] text-white px-1.5 rounded text-[10px] font-bold">
                  {viewers.size}
                </span>
              </div>
              <ScrollArea className="h-[80px]">
                <div className="p-1 space-y-0.5">
                  {Array.from(viewers.entries()).map(([userId, viewer]) => (
                    <div 
                      key={userId}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold truncate ${
                        userId === user?.id 
                          ? "bg-[#3388cc] text-white" 
                          : "text-[#2266aa] hover:bg-white/50"
                      }`}
                    >
                      {viewer.username}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat Area */}
            <div className="bg-white/60 rounded border border-[#8aa8b8] flex flex-col">
              {chatVisible && (
                <ScrollArea className="flex-1 h-[60px] px-2 py-1" ref={chatScrollRef}>
                  {chatMessages.length === 0 ? (
                    <p className="text-[#6a8a9a] text-[11px] italic">No messages yet...</p>
                  ) : (
                    <div className="space-y-0.5">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="text-[11px]">
                          <span className={`font-bold ${
                            msg.userId === user?.id ? "text-[#3388cc]" : "text-[#2266aa]"
                          }`}>
                            {msg.username}:
                          </span>
                          <span className="text-[#3a5a6a] ml-1">{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
              
              <div className="p-1 border-t border-[#8aa8b8] bg-white/40">
                <div className="text-[#5a7a8a] text-[9px] font-semibold mb-0.5">SELECT A MESSAGE TO CHAT</div>
                <div className="flex gap-1">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder=""
                    className="flex-1 h-6 text-[11px] bg-white border-[#8aa8b8]"
                  />
                  <button 
                    onClick={sendChatMessage}
                    className="bg-[#3388cc] hover:bg-[#44aaee] text-white font-bold text-[10px] px-3 rounded"
                  >
                    SEND
                  </button>
                </div>
              </div>
            </div>

            {/* Hide Button */}
            <button 
              onClick={() => setChatVisible(!chatVisible)}
              className="bg-gradient-to-b from-[#d0e0e8] to-[#b0c8d8] hover:from-[#e0f0f8] hover:to-[#c0d8e8] text-[#3a6a7a] font-bold text-[10px] rounded border border-[#8aa8b8] h-full"
            >
              {chatVisible ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        {/* Bid History */}
        <div className="mt-3 bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] rounded-lg p-3">
          <div className="text-[#3a5a6a] font-black text-sm mb-2">BID HISTORY ({bids.length})</div>
          {bids.length === 0 ? (
            <p className="text-[#6a8a9a] text-center py-2 text-sm">No bids yet</p>
          ) : (
            <div className="grid gap-1 max-h-32 overflow-y-auto">
              {bids.slice(0, 8).map((bid, index) => (
                <div 
                  key={bid.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-sm ${
                    index === 0 ? "bg-yellow-200 border border-yellow-400" : "bg-white/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      index === 0 ? "bg-yellow-500 text-white" : "bg-[#8aa8b8] text-white"
                    }`}>
                      {index === 0 ? "👑" : index + 1}
                    </span>
                    <span className={`font-semibold truncate ${
                      bid.user_id === user?.id ? "text-[#3388cc]" : "text-[#3a5a6a]"
                    }`}>
                      {bid.username}
                    </span>
                  </div>
                  <span className="font-bold text-[#2266aa]">
                    {bid.bid_amount.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Info Modal */}
      <Dialog open={showCardInfo} onOpenChange={setShowCardInfo}>
        <DialogContent className="bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] border-[#3388bb] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#2266aa] font-black">{card.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <img 
              src={imageUrl}
              alt={card.title}
              className="w-full rounded-lg border-2 border-[#3388bb]"
            />
            <div className="bg-white/70 rounded p-3 border border-[#8aa8b8]">
              <div className="text-[#4a6a7a] text-xs font-bold mb-1">BASE POINTS:</div>
              <div className="text-[#2266aa] font-black text-xl">{card.basePoints}</div>
            </div>
            <div className="bg-white/70 rounded p-3 border border-[#8aa8b8]">
              <div className="text-[#4a6a7a] text-xs font-bold mb-1">COLOR:</div>
              <div className="text-[#2266aa] font-black capitalize">{card.colors?.join(', ') || 'None'}</div>
            </div>
            {card.description && (
              <div className="bg-white/70 rounded p-3 border border-[#8aa8b8]">
                <div className="text-[#4a6a7a] text-xs font-bold mb-1">POWER:</div>
                <div className="text-[#3a5a6a] text-sm">{card.description}</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
