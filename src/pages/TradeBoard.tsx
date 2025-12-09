import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTrades } from "@/hooks/useTrades";
import { useUserCards } from "@/hooks/useUserCards";
import { useAuctions } from "@/hooks/useAuctions";
import { getCardById } from "@/lib/gameEngine";
import { MiniCard, CardChip } from "@/components/MiniCard";
import { toast } from "sonner";
import { 
  ArrowLeft, Coins, ArrowRightLeft, Plus, Gavel, Clock, 
  TrendingUp, User
} from "lucide-react";
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
import cardsData from "@/data/cards.json";

export default function TradeBoard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const { trades, loading: tradesLoading, createTrade, acceptTrade, cancelTrade } = useTrades();
  const { userCards, getOwnedCardIds } = useUserCards();
  const { 
    auctions, 
    loading: auctionsLoading, 
    createAuction, 
    placeBid, 
    cancelAuction,
    endAuction 
  } = useAuctions();

  // Trade form state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [offerCardIds, setOfferCardIds] = useState<number[]>([]);
  const [offerCoins, setOfferCoins] = useState(0);
  const [wantCardIds, setWantCardIds] = useState<number[]>([]);
  const [wantCoins, setWantCoins] = useState(0);
  const [selectedOfferCard, setSelectedOfferCard] = useState<string>("");
  const [selectedWantCard, setSelectedWantCard] = useState<string>("");

  // Auction form state
  const [showAuctionDialog, setShowAuctionDialog] = useState(false);
  const [auctionCardId, setAuctionCardId] = useState<string>("");
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

  const ownedCardIds = getOwnedCardIds();
  const allCards = (cardsData as { id: number; title: string }[]).sort((a, b) => 
    a.title.localeCompare(b.title)
  );
  
  const ownedCardsWithDetails = ownedCardIds
    .map((id) => getCardById(id))
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort((a, b) => a.title.localeCompare(b.title));

  // Trade handlers
  const handleCreateTrade = async () => {
    const success = await createTrade(offerCardIds, offerCoins, wantCardIds, wantCoins);
    if (success) {
      setShowCreateDialog(false);
      setOfferCardIds([]);
      setOfferCoins(0);
      setWantCardIds([]);
      setWantCoins(0);
      toast.success("Trade created!");
    }
  };

  const addOfferCard = () => {
    if (selectedOfferCard && !offerCardIds.includes(parseInt(selectedOfferCard))) {
      setOfferCardIds([...offerCardIds, parseInt(selectedOfferCard)]);
      setSelectedOfferCard("");
    }
  };

  const addWantCard = () => {
    if (selectedWantCard && !wantCardIds.includes(parseInt(selectedWantCard))) {
      setWantCardIds([...wantCardIds, parseInt(selectedWantCard)]);
      setSelectedWantCard("");
    }
  };

  // Auction handlers
  const handleCreateAuction = async () => {
    if (!auctionCardId) {
      toast.error("Please select a card");
      return;
    }

    const result = await createAuction(
      parseInt(auctionCardId),
      startingBid,
      auctionDuration
    );

    if (result.success) {
      setShowAuctionDialog(false);
      setAuctionCardId("");
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
          <div className="flex items-center gap-2 text-foreground">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="font-bold">{profile?.coins || 0}</span>
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
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Trade</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Offering */}
                    <div>
                      <Label className="text-lg font-semibold">You Offer</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <Select value={selectedOfferCard} onValueChange={setSelectedOfferCard}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select a card you own" />
                            </SelectTrigger>
                            <SelectContent>
                              {ownedCardsWithDetails.map((card) => (
                                <SelectItem key={card.id} value={card.id.toString()}>
                                  {card.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addOfferCard} size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {offerCardIds.map((cardId) => {
                            const card = getCardById(cardId);
                            return card ? (
                              <CardChip 
                                key={cardId} 
                                card={card} 
                                onRemove={() => setOfferCardIds(offerCardIds.filter(id => id !== cardId))}
                              />
                            ) : null;
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Coins:</Label>
                          <Input
                            type="number"
                            value={offerCoins}
                            onChange={(e) => setOfferCoins(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-24"
                            min={0}
                            max={profile?.coins || 0}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Wanting */}
                    <div>
                      <Label className="text-lg font-semibold">You Want</Label>
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <Select value={selectedWantCard} onValueChange={setSelectedWantCard}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select a card you want" />
                            </SelectTrigger>
                            <SelectContent>
                              {allCards.map((card) => (
                                <SelectItem key={card.id} value={card.id.toString()}>
                                  {card.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addWantCard} size="icon">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {wantCardIds.map((cardId) => {
                            const card = getCardById(cardId);
                            return card ? (
                              <CardChip 
                                key={cardId} 
                                card={card}
                                onRemove={() => setWantCardIds(wantCardIds.filter(id => id !== cardId))}
                              />
                            ) : null;
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Coins:</Label>
                          <Input
                            type="number"
                            value={wantCoins}
                            onChange={(e) => setWantCoins(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-24"
                            min={0}
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateTrade}
                      className="w-full"
                      disabled={
                        (offerCardIds.length === 0 && offerCoins === 0) ||
                        (wantCardIds.length === 0 && wantCoins === 0)
                      }
                    >
                      Create Trade
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
                              {trade.offer_card_ids.map((cardId) => {
                                const card = getCardById(cardId);
                                return card ? (
                                  <div key={cardId} className="flex items-center gap-2">
                                    <MiniCard card={card} size="sm" />
                                    <span className="text-sm text-muted-foreground">{card.title}</span>
                                  </div>
                                ) : null;
                              })}
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
                                    <MiniCard card={card} size="sm" />
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

          {/* AUCTIONS TAB */}
          <TabsContent value="auctions" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAuctionDialog} onOpenChange={setShowAuctionDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Gavel className="mr-2 h-4 w-4" />
                    Create Auction
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Auction</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Card to Auction</Label>
                      <Select value={auctionCardId} onValueChange={setAuctionCardId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a card" />
                        </SelectTrigger>
                        <SelectContent>
                          {ownedCardsWithDetails.map((card) => (
                            <SelectItem key={card.id} value={card.id.toString()}>
                              <div className="flex items-center gap-2">
                                {card.title}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {auctionCardId && (
                        <div className="mt-2 flex justify-center">
                          <MiniCard card={getCardById(parseInt(auctionCardId))!} size="md" />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Starting Bid (coins)</Label>
                      <Input
                        type="number"
                        value={startingBid}
                        onChange={(e) => setStartingBid(Math.max(1, parseInt(e.target.value) || 1))}
                        min={1}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Duration</Label>
                      <Select 
                        value={auctionDuration.toString()} 
                        onValueChange={(v) => setAuctionDuration(parseInt(v))}
                      >
                        <SelectTrigger className="mt-1">
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
                    <Button onClick={handleCreateAuction} className="w-full" disabled={!auctionCardId}>
                      Start Auction
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {auctionsLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading auctions...</div>
            ) : auctions.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No active auctions. Start one now!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {auctions.map((auction) => {
                  const card = getCardById(auction.card_id);
                  if (!card) return null;
                  
                  const isOwner = auction.user_id === user.id;
                  const isHighestBidder = auction.highest_bidder_id === user.id;
                  const ended = isAuctionEnded(auction.ends_at);
                  const minBid = auction.current_bid > 0 
                    ? auction.current_bid + auction.min_increment 
                    : auction.starting_bid;
                  const currentBidAmount = bidAmounts[auction.id] || minBid;

                  return (
                    <Card 
                      key={auction.id} 
                      className={`bg-card border-border relative overflow-hidden ${
                        ended ? "opacity-75" : ""
                      } ${isHighestBidder ? "ring-2 ring-green-500" : ""}`}
                    >
                      {ended && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                          <span className="text-lg font-bold text-muted-foreground">ENDED</span>
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {/* Card Image */}
                          <div className="flex-shrink-0">
                            <MiniCard card={card} size="md" />
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-foreground truncate">{card.title}</h3>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <User className="h-3 w-3" />
                              {auction.seller_username}
                            </div>
                            
                            {/* Timer */}
                            <div className={`flex items-center gap-1 text-sm mt-2 ${
                              ended ? "text-red-500" : "text-orange-500"
                            }`}>
                              <Clock className="h-4 w-4" />
                              {formatTimeLeft(auction.ends_at)}
                            </div>
                            
                            {/* Current Bid */}
                            <div className="flex items-center gap-1 mt-2">
                              <TrendingUp className="h-4 w-4 text-green-500" />
                              <span className="text-lg font-bold text-yellow-500">
                                {auction.current_bid > 0 ? auction.current_bid : auction.starting_bid}
                              </span>
                              <Coins className="h-4 w-4 text-yellow-500" />
                            </div>
                            {auction.highest_bidder_username && (
                              <div className="text-xs text-muted-foreground">
                                Highest: {auction.highest_bidder_username}
                                {isHighestBidder && <span className="text-green-500 ml-1">(You!)</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-3 border-t border-border">
                          {isOwner ? (
                            <div className="flex gap-2">
                              {auction.current_bid === 0 && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => cancelAuction(auction.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                              {ended && (
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleEndAuction(auction.id)}
                                >
                                  Finalize
                                </Button>
                              )}
                            </div>
                          ) : !ended ? (
                            <div className="flex gap-2 items-center">
                              <Input
                                type="number"
                                value={currentBidAmount}
                                onChange={(e) => setBidAmounts(prev => ({
                                  ...prev,
                                  [auction.id]: parseInt(e.target.value) || minBid
                                }))}
                                min={minBid}
                                className="w-24"
                              />
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handlePlaceBid(auction.id, currentBidAmount)}
                                disabled={currentBidAmount < minBid}
                              >
                                Bid
                              </Button>
                            </div>
                          ) : isHighestBidder ? (
                            <div className="text-center text-green-500 font-semibold">
                              You won! Waiting for seller to finalize.
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
