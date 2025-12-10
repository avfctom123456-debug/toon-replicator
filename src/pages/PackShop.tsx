import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePacks } from "@/hooks/usePacks";
import { useStarterDeck } from "@/hooks/useStarterDeck";
import { starterDecks } from "@/lib/starterDecks";
import { ArrowLeft, Package, Coins, Gift } from "lucide-react";
import { PackOpeningModal } from "@/components/pack/PackOpeningModal";

export default function PackShop() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { packs, loading: packsLoading, openPack } = usePacks();
  const { hasClaimedStarterDeck, claimStarterDeck } = useStarterDeck();
  const [openedCards, setOpenedCards] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [opening, setOpening] = useState(false);

  if (authLoading || profileLoading) {
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

  const handleOpenPack = async (packId: string) => {
    setOpening(true);
    const cards = await openPack(packId);
    if (cards) {
      setOpenedCards(cards);
      setShowResults(true);
    }
    setOpening(false);
  };

  const handleClaimStarter = async (slot: string) => {
    await claimStarterDeck(slot);
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
            {(profile?.free_packs_remaining ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                <Gift className="h-4 w-4" />
                <span className="font-bold text-sm">{profile?.free_packs_remaining} Free</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-foreground">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="font-bold">{profile?.coins || 0}</span>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-8 text-center">Pack Shop</h1>

        {/* Starter Deck Selection */}
        {!hasClaimedStarterDeck && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500" />
              Choose Your Free Starter Deck
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {starterDecks.map((deck) => (
                <Card key={deck.slot} className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">{deck.name}</CardTitle>
                    <CardDescription>{deck.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {deck.cardIds.length} cards included
                    </p>
                    <Button
                      onClick={() => handleClaimStarter(deck.slot)}
                      className="w-full"
                      variant="default"
                    >
                      Claim This Deck
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Packs */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Available Packs
          </h2>
          
          {packsLoading ? (
            <div className="text-muted-foreground">Loading packs...</div>
          ) : packs.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No packs available yet. Check back later!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packs.map((pack) => (
                <Card key={pack.id} className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">{pack.name}</CardTitle>
                    {pack.description && (
                      <CardDescription>{pack.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">
                        {pack.cards_per_pack} cards
                      </span>
                      {(profile?.free_packs_remaining ?? 0) > 0 ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <Gift className="h-4 w-4" />
                          <span className="font-bold">FREE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Coins className="h-4 w-4" />
                          <span className="font-bold">{pack.cost}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => handleOpenPack(pack.id)}
                      disabled={opening || ((profile?.free_packs_remaining ?? 0) === 0 && (profile?.coins || 0) < pack.cost)}
                      className="w-full"
                    >
                      {opening ? "Opening..." : (profile?.free_packs_remaining ?? 0) > 0 ? "Open Free Pack" : "Open Pack"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pack Opening Modal */}
      <PackOpeningModal
        open={showResults}
        onClose={() => setShowResults(false)}
        cardIds={openedCards}
      />
    </div>
  );
}
