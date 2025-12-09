import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTrades } from "@/hooks/useTrades";
import { useUserCards } from "@/hooks/useUserCards";
import { getCardById } from "@/lib/gameEngine";
import { ArrowLeft, Coins, ArrowRightLeft, Plus, X } from "lucide-react";
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
  const { profile } = useProfile();
  const { trades, loading: tradesLoading, createTrade, acceptTrade, cancelTrade } = useTrades();
  const { userCards, getOwnedCardIds } = useUserCards();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [offerCardIds, setOfferCardIds] = useState<number[]>([]);
  const [offerCoins, setOfferCoins] = useState(0);
  const [wantCardIds, setWantCardIds] = useState<number[]>([]);
  const [wantCoins, setWantCoins] = useState(0);
  const [selectedOfferCard, setSelectedOfferCard] = useState<string>("");
  const [selectedWantCard, setSelectedWantCard] = useState<string>("");

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
  const allCards = cardsData as { id: number; title: string }[];

  const handleCreateTrade = async () => {
    const success = await createTrade(offerCardIds, offerCoins, wantCardIds, wantCoins);
    if (success) {
      setShowCreateDialog(false);
      setOfferCardIds([]);
      setOfferCoins(0);
      setWantCardIds([]);
      setWantCoins(0);
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

  const removeOfferCard = (cardId: number) => {
    setOfferCardIds(offerCardIds.filter((id) => id !== cardId));
  };

  const removeWantCard = (cardId: number) => {
    setWantCardIds(wantCardIds.filter((id) => id !== cardId));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-foreground">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="font-bold">{profile?.coins || 0}</span>
            </div>
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
                            {ownedCardIds.map((cardId) => {
                              const card = getCardById(cardId);
                              return card ? (
                                <SelectItem key={cardId} value={cardId.toString()}>
                                  {card.title}
                                </SelectItem>
                              ) : null;
                            })}
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
                            <div
                              key={cardId}
                              className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                            >
                              {card.title}
                              <button onClick={() => removeOfferCard(cardId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
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
                            <div
                              key={cardId}
                              className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                            >
                              {card.title}
                              <button onClick={() => removeWantCard(cardId)}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
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
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-8 text-center flex items-center justify-center gap-2">
          <ArrowRightLeft className="h-8 w-8" />
          Trade Board
        </h1>

        {tradesLoading ? (
          <div className="text-center text-muted-foreground">Loading trades...</div>
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
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">
                      {isOwner ? "Your Trade" : "Trade Offer"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2">Offering:</p>
                        <div className="space-y-1">
                          {trade.offer_card_ids.map((cardId) => {
                            const card = getCardById(cardId);
                            return card ? (
                              <div key={cardId} className="text-sm text-muted-foreground">
                                • {card.title}
                              </div>
                            ) : null;
                          })}
                          {trade.offer_coins > 0 && (
                            <div className="flex items-center gap-1 text-sm text-yellow-500">
                              <Coins className="h-3 w-3" />
                              {trade.offer_coins} coins
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-2">Wants:</p>
                        <div className="space-y-1">
                          {trade.want_card_ids.map((cardId) => {
                            const card = getCardById(cardId);
                            return card ? (
                              <div key={cardId} className="text-sm text-muted-foreground">
                                • {card.title}
                              </div>
                            ) : null;
                          })}
                          {trade.want_coins > 0 && (
                            <div className="flex items-center gap-1 text-sm text-yellow-500">
                              <Coins className="h-3 w-3" />
                              {trade.want_coins} coins
                            </div>
                          )}
                        </div>
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
      </div>
    </div>
  );
}
