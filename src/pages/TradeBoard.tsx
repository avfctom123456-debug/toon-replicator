import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClickableUsername } from "@/components/ClickableUsername";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTrades } from "@/hooks/useTrades";
import { useUserCards } from "@/hooks/useUserCards";
import { useAuctions } from "@/hooks/useAuctions";
import { useCardOverrides } from "@/hooks/useCardOverrides";
import { getCardById } from "@/lib/gameEngine";
import { MiniCard, CardChip } from "@/components/MiniCard";
import { toast } from "sonner";
import { 
  ArrowLeft, Coins, ArrowRightLeft, Plus, Gavel, Clock, 
  TrendingUp, User, History, ExternalLink
} from "lucide-react";
import { AuctionBidHistoryModal } from "@/components/trade/AuctionBidHistoryModal";
import { CardPickerModal } from "@/components/trade/CardPickerModal";
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

export default function TradeBoard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { trades, loading: tradesLoading, createTrade, acceptTrade, cancelTrade } = useTrades();
  const { userCards } = useUserCards();
  const { 
    auctions, 
    loading: auctionsLoading, 
    createAuction, 
    placeBid, 
    cancelAuction,
    endAuction 
  } = useAuctions();
  const { getOverride } = useCardOverrides();

  // Trade form state - simplified: only offer cards and/or coins
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [offerUserCardIds, setOfferUserCardIds] = useState<string[]>([]);
  const [offerCoins, setOfferCoins] = useState(0);

  // Auction form state - now uses specific user_card
  const [showAuctionDialog, setShowAuctionDialog] = useState(false);
  const [auctionUserCardId, setAuctionUserCardId] = useState<string>("");
  const [startingBid, setStartingBid] = useState(10);
  const [auctionDuration, setAuctionDuration] = useState(60); // minutes

  // Bidding state
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});

  // Timer for auction countdowns
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Build list of owned cards with their specific copy info
  const ownedCardsWithCopies = userCards
    .map(uc => {
      const cardData = getCardById(uc.card_id);
      return cardData ? {
        ...cardData,
        userCardId: uc.id,
        copyNumber: uc.copy_number,
      } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.title.localeCompare(b.title) || (a.copyNumber || 0) - (b.copyNumber || 0));

  // Trade handlers
  const handleCreateTrade = async () => {
    // Extract card_ids from user_card selection for the offer
    const offerCardIds = offerUserCardIds.map(ucId => {
      const uc = userCards.find(u => u.id === ucId);
      return uc?.card_id || 0;
    }).filter(id => id > 0);
    
    // Pass empty arrays for want (trades are now just offers)
    const success = await createTrade(offerCardIds, offerCoins, [], 0, offerUserCardIds);
    if (success) {
      setShowCreateDialog(false);
      setOfferUserCardIds([]);
      setOfferCoins(0);
      toast.success("Trade offer created!");
    }
  };

  const handleAddOfferCard = (userCardId: string) => {
    if (!offerUserCardIds.includes(userCardId) && offerUserCardIds.length < 12) {
      setOfferUserCardIds([...offerUserCardIds, userCardId]);
    }
  };

  // Auction handlers
  const handleCreateAuction = async () => {
    if (!auctionUserCardId) {
      toast.error("Please select a card");
      return;
    }

    const selectedCard = ownedCardsWithCopies.find(c => c.userCardId === auctionUserCardId);
    if (!selectedCard) {
      toast.error("Card not found");
      return;
    }

    const result = await createAuction(
      selectedCard.id,
      startingBid,
      auctionDuration,
      auctionUserCardId
    );

    if (result.success) {
      setShowAuctionDialog(false);
      setAuctionUserCardId("");
      setStartingBid(10);
      setAuctionDuration(60);
      toast.success("Auction created!");
    } else {
      toast.error(result.error || "Failed to create auction");
    }
  };

  const handlePlaceBid = async (auctionId: string, minBid: number) => {
    const bidAmount = bidAmounts[auctionId] || minBid;
    const result = await placeBid(auctionId, bidAmount);

    if (result.success) {
      toast.success(`Bid of ${bidAmount} coins placed!`);
      setBidAmounts(prev => ({ ...prev, [auctionId]: 0 }));
      refetchProfile();
    } else {
      toast.error(result.error || "Failed to place bid");
    }
  };

  const handleEndAuction = async (auctionId: string) => {
    const result = await endAuction(auctionId);
    if (result.success) {
      toast.success("Auction ended!");
      refetchProfile();
    } else {
      toast.error(result.error || "Failed to end auction");
    }
  };

  const formatTimeLeft = (endsAt: string) => {
    const endTime = new Date(endsAt).getTime();
    const diff = endTime - now;
    
    if (diff <= 0) return "Ended";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  };

  const isAuctionEnded = (endsAt: string) => {
    return new Date(endsAt).getTime() <= now;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/home")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3 text-foreground">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="font-bold">{profile?.coins || 0}</span>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-6 text-center flex items-center justify-center gap-2">
          <ArrowRightLeft className="h-8 w-8" />
          Trade Board
        </h1>

        <Tabs defaultValue="trades" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="trades" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Trades
            </TabsTrigger>
            <TabsTrigger value="auctions" className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              Live Auctions
            </TabsTrigger>
          </TabsList>

          {/* TRADES TAB */}
          <TabsContent value="trades" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Trade
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Trade Offer</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      List cards and/or coins you want to trade. Other players can browse and accept your offer.
                    </p>

                    {/* Card Picker */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-semibold">Cards to Offer</Label>
                        <span className="text-xs text-muted-foreground">{offerUserCardIds.length}/12</span>
                      </div>
                      
                      <CardPickerModal
                        cards={ownedCardsWithCopies}
                        selectedIds={offerUserCardIds}
                        onSelect={handleAddOfferCard}
                        maxCards={12}
                      />

                      {/* Selected cards display */}
                      {offerUserCardIds.length > 0 && (
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {offerUserCardIds.map((userCardId) => {
                            const cardCopy = ownedCardsWithCopies.find(c => c.userCardId === userCardId);
                            if (!cardCopy) return null;
                            const imageUrl = getOverride(cardCopy.id)?.custom_image_url || 
                              `https://dlgjmqnjzepntvfeqfcx.supabase.co/storage/v1/object/public/card-images/${cardCopy.id}.jpg`;
                            return (
                              <div key={userCardId} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden border-2 border-border">
                                  <img 
                                    src={imageUrl}
                                    alt={cardCopy.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {cardCopy.copyNumber && (
                                    <div className={`absolute top-0.5 right-0.5 px-1 rounded text-[8px] font-bold ${
                                      cardCopy.copyNumber <= 10 ? "bg-yellow-500 text-yellow-950" :
                                      cardCopy.copyNumber <= 50 ? "bg-gray-400 text-gray-900" : "bg-black/60 text-white"
                                    }`}>
                                      #{cardCopy.copyNumber}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setOfferUserCardIds(offerUserCardIds.filter(id => id !== userCardId))}
                                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                                <p className="text-[9px] text-center truncate mt-0.5">{cardCopy.title}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Coins */}
                    <div>
                      <Label className="font-semibold">Coins to Offer</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        <Input
                          type="number"
                          value={offerCoins}
                          onChange={(e) => setOfferCoins(Math.max(0, Math.min(profile?.coins || 0, parseInt(e.target.value) || 0)))}
                          className="w-32"
                          min={0}
                          max={profile?.coins || 0}
                        />
                        <span className="text-xs text-muted-foreground">/ {profile?.coins || 0} available</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateTrade}
                      className="w-full"
                      disabled={offerUserCardIds.length === 0 && offerCoins === 0}
                    >
                      Create Trade Offer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {tradesLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading trades...</div>
            ) : trades.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No open trades. Be the first to create one!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {trades.map((trade) => {
                  const isOwner = trade.user_id === user.id;
                  return (
                    <Card key={trade.id} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">
                          {isOwner ? "Your Trade" : "Trade Offer"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">Offering:</p>
                            <div className="flex flex-wrap gap-2">
                              {trade.offer_cards_with_copies && trade.offer_cards_with_copies.length > 0 
                                ? trade.offer_cards_with_copies.map((offerCard) => {
                                    const card = getCardById(offerCard.card_id);
                                    return card ? (
                                      <div key={offerCard.user_card_id} className="flex items-center gap-2">
                                        <MiniCard card={card} size="sm" copyNumber={offerCard.copy_number} customImageUrl={getOverride(offerCard.card_id)?.custom_image_url} />
                                        <span className="text-sm text-muted-foreground">
                                          {card.title}
                                          {offerCard.copy_number && (
                                            <span className={`ml-1 ${
                                              offerCard.copy_number <= 10 ? "text-yellow-500 font-bold" :
                                              offerCard.copy_number <= 50 ? "text-gray-400" : ""
                                            }`}>
                                              #{offerCard.copy_number}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    ) : null;
                                  })
                                : trade.offer_card_ids.map((cardId) => {
                                    const card = getCardById(cardId);
                                    return card ? (
                                      <div key={cardId} className="flex items-center gap-2">
                                        <MiniCard card={card} size="sm" customImageUrl={getOverride(cardId)?.custom_image_url} />
                                        <span className="text-sm text-muted-foreground">{card.title}</span>
                                      </div>
                                    ) : null;
                                  })
                              }
                            </div>
                            {trade.offer_coins > 0 && (
                              <div className="flex items-center gap-1 text-sm text-yellow-500 mt-2">
                                <Coins className="h-4 w-4" />
                                {trade.offer_coins} coins
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">Wants:</p>
                            <div className="flex flex-wrap gap-2">
                              {trade.want_card_ids.map((cardId) => {
                                const card = getCardById(cardId);
                                return card ? (
                                  <div key={cardId} className="flex items-center gap-2">
                                    <MiniCard card={card} size="sm" customImageUrl={getOverride(cardId)?.custom_image_url} />
                                    <span className="text-sm text-muted-foreground">{card.title}</span>
                                  </div>
                                ) : null;
                              })}
                            </div>
                            {trade.want_coins > 0 && (
                              <div className="flex items-center gap-1 text-sm text-yellow-500 mt-2">
                                <Coins className="h-4 w-4" />
                                {trade.want_coins} coins
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          {isOwner ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => cancelTrade(trade.id)}
                            >
                              Cancel Trade
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => acceptTrade(trade.id)}>
                              Accept Trade
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* AUCTIONS TAB - ORBIT STYLE */}
          <TabsContent value="auctions" className="space-y-4">
            {/* Orbit-style header */}
            <div 
              className="rounded-lg p-4"
              style={{
                background: 'linear-gradient(135deg, #1a5a6a 0%, #2a7a8a 25%, #3a8a9a 50%, #2a7a8a 75%, #1a5a6a 100%)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Planet icon */}
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg relative">
                    <div className="absolute w-14 h-3 border-2 border-cyan-300 rounded-full -rotate-12 opacity-60"></div>
                    <div className="w-5 h-5 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-cyan-200 font-bold text-xs tracking-wide">GET CARDS</div>
                    <div className="text-white font-black text-xl tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                      AUCTIONS
                    </div>
                  </div>
                </div>
                
                <Dialog open={showAuctionDialog} onOpenChange={setShowAuctionDialog}>
                  <DialogTrigger asChild>
                    <button className="bg-gradient-to-b from-[#ff8833] to-[#cc5500] hover:from-[#ffaa55] hover:to-[#dd6600] text-white font-bold text-sm py-2 px-4 rounded-lg shadow-lg border-2 border-[#aa4400]">
                      START AUCTION
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] border-[#3388bb]">
                    <DialogHeader>
                      <DialogTitle className="text-[#2266aa] font-black">CREATE AUCTION</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label className="text-[#4a6a7a] font-bold text-sm">Card to Auction</Label>
                        <Select value={auctionUserCardId} onValueChange={setAuctionUserCardId}>
                          <SelectTrigger className="mt-1 bg-white/70 border-[#8aa8b8]">
                            <SelectValue placeholder="Select a card copy" />
                          </SelectTrigger>
                          <SelectContent>
                            {ownedCardsWithCopies.map((card) => (
                              <SelectItem key={card.userCardId} value={card.userCardId}>
                                <span className="flex items-center gap-2">
                                  {card.title}
                                  {card.copyNumber && (
                                    <span className={`text-xs ${
                                      card.copyNumber <= 10 ? "text-yellow-500 font-bold" :
                                      card.copyNumber <= 50 ? "text-gray-400" : "text-muted-foreground"
                                    }`}>
                                      #{card.copyNumber}
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {auctionUserCardId && (
                          <div className="mt-2 flex justify-center">
                            {(() => {
                              const selectedCard = ownedCardsWithCopies.find(c => c.userCardId === auctionUserCardId);
                              return selectedCard ? (
                                <MiniCard card={selectedCard} size="md" copyNumber={selectedCard.copyNumber} customImageUrl={getOverride(selectedCard.id)?.custom_image_url} />
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-[#4a6a7a] font-bold text-sm">Starting Bid (points)</Label>
                        <Input
                          type="number"
                          value={startingBid}
                          onChange={(e) => setStartingBid(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                          className="mt-1 bg-white/70 border-[#8aa8b8]"
                        />
                      </div>
                      <div>
                        <Label className="text-[#4a6a7a] font-bold text-sm">Duration</Label>
                        <Select 
                          value={auctionDuration.toString()} 
                          onValueChange={(v) => setAuctionDuration(parseInt(v))}
                        >
                          <SelectTrigger className="mt-1 bg-white/70 border-[#8aa8b8]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="180">3 hours</SelectItem>
                            <SelectItem value="720">12 hours</SelectItem>
                            <SelectItem value="1440">24 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <button 
                        onClick={handleCreateAuction} 
                        className="w-full bg-gradient-to-b from-[#ff8833] to-[#cc5500] hover:from-[#ffaa55] hover:to-[#dd6600] text-white font-bold py-3 rounded-lg border-2 border-[#aa4400] disabled:opacity-50"
                        disabled={!auctionUserCardId}
                      >
                        START AUCTION
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Auction List */}
              {auctionsLoading ? (
                <div className="text-center text-cyan-200 py-8">Loading auctions...</div>
              ) : auctions.length === 0 ? (
                <div className="bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] rounded-lg p-8 text-center">
                  <p className="text-[#4a6a7a] font-semibold">No active auctions. Start one now!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {auctions.map((auction) => {
                    const card = getCardById(auction.card_id);
                    if (!card) return null;
                    
                    const isOwner = auction.user_id === user.id;
                    const isHighestBidder = auction.highest_bidder_id === user.id;
                    const ended = isAuctionEnded(auction.ends_at);
                    const currentBid = auction.current_bid > 0 ? auction.current_bid : auction.starting_bid;
                    const imageUrl = getOverride(auction.card_id)?.custom_image_url || `https://dlgjmqnjzepntvfeqfcx.supabase.co/storage/v1/object/public/card-images/${card.id}.jpg`;

                    // Get time components
                    const endTime = new Date(auction.ends_at).getTime();
                    const diff = Math.max(0, endTime - now);
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                    return (
                      <div 
                        key={auction.id} 
                        onClick={() => navigate(`/auction/${auction.id}`)}
                        className={`bg-gradient-to-b from-[#c8d8e8] to-[#a8c8d8] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all ${
                          isHighestBidder ? "ring-2 ring-green-400" : ""
                        }`}
                      >
                        {/* Card image with concentric circles */}
                        <div 
                          className="h-[120px] sm:h-[140px] relative"
                          style={{
                            background: `radial-gradient(circle at center, 
                              #000000 0%, #000000 15%, 
                              #661111 20%, #882222 25%, #aa3333 30%,
                              #cc4444 35%, #dd5544 40%, #ee6644 45%,
                              #ff7755 50%, #ee6644 55%, #dd5544 60%,
                              #cc4444 65%, #aa3333 70%
                            )`
                          }}
                        >
                          {/* Card Name Badge */}
                          <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-[#cc3344] via-[#dd5544] to-[#ee7744] rounded px-1.5 py-0.5 border border-[#aa2233] max-w-[70%]">
                            <div className="text-white font-black text-[10px] sm:text-xs uppercase truncate" style={{ textShadow: '1px 1px 1px rgba(0,0,0,0.5)' }}>
                              {card.title}
                              {auction.copy_number && (
                                <span className={`ml-1 ${
                                  auction.copy_number <= 10 ? "text-yellow-300" :
                                  auction.copy_number <= 50 ? "text-gray-300" : "text-white/70"
                                }`}>
                                  #{auction.copy_number}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Timer Badge */}
                          <div className="absolute top-1.5 right-1.5 flex gap-0.5 bg-black/50 rounded px-1.5 py-0.5">
                            <span className="bg-[#cc3333] text-white font-bold text-[10px] px-1 rounded">
                              {String(hours).padStart(2, '0')}
                            </span>
                            <span className="text-white text-[10px]">:</span>
                            <span className="bg-[#cc3333] text-white font-bold text-[10px] px-1 rounded">
                              {String(minutes).padStart(2, '0')}
                            </span>
                            <span className="text-white text-[10px]">:</span>
                            <span className="bg-[#cc3333] text-white font-bold text-[10px] px-1 rounded">
                              {String(seconds).padStart(2, '0')}
                            </span>
                          </div>

                          {/* Card Image */}
                          <div className="w-full h-full flex items-center justify-center pt-4">
                            <img 
                              src={imageUrl}
                              alt={card.title}
                              className="max-w-[45%] max-h-[75%] object-contain"
                              style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.8))' }}
                            />
                          </div>

                          {ended && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white font-black text-xl">ENDED</span>
                            </div>
                          )}
                        </div>

                        {/* Info section */}
                        <div className="p-2 sm:p-3 space-y-1.5">
                          {/* Current bid */}
                          <div className="flex items-center justify-between">
                            <span className="text-[#5a7a8a] text-[10px] sm:text-xs font-semibold">Current Bid:</span>
                            <span className="text-[#2266aa] font-black text-sm sm:text-base">
                              {currentBid.toLocaleString()} PTS
                            </span>
                          </div>
                          
                          {/* High bidder */}
                          <div className="flex items-center justify-between">
                            <span className="text-[#5a7a8a] text-[10px] sm:text-xs">High Bidder:</span>
                            <span className={`text-[10px] sm:text-xs font-semibold truncate max-w-[100px] ${
                              isHighestBidder ? "text-green-600" : "text-[#4a6a7a]"
                            }`} onClick={(e) => e.stopPropagation()}>
                              {auction.highest_bidder_id ? (
                                <>
                                  <ClickableUsername
                                    userId={auction.highest_bidder_id}
                                    username={auction.highest_bidder_username || "Unknown"}
                                    className={isHighestBidder ? "text-green-600" : "text-[#4a6a7a]"}
                                  />
                                  {isHighestBidder && " (You!)"}
                                </>
                              ) : (
                                "No bids"
                              )}
                            </span>
                          </div>

                          {/* Seller */}
                          <div className="flex items-center justify-between">
                            <span className="text-[#5a7a8a] text-[10px] sm:text-xs">Seller:</span>
                            <span className="text-[#4a6a7a] text-[10px] sm:text-xs truncate max-w-[100px]" onClick={(e) => e.stopPropagation()}>
                              <ClickableUsername
                                userId={auction.user_id}
                                username={auction.seller_username}
                                className="text-[#4a6a7a]"
                              />
                            </span>
                          </div>

                          {/* View button */}
                          <button
                            className="w-full bg-[#3388cc] hover:bg-[#44aaee] text-white font-bold text-[10px] sm:text-xs py-1.5 sm:py-2 rounded mt-1"
                          >
                            VIEW AUCTION
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
