import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCardById } from "@/lib/gameEngine";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PackOpeningModalProps {
  open: boolean;
  onClose: () => void;
  cardIds: number[];
}

export function PackOpeningModal({ open, onClose, cardIds }: PackOpeningModalProps) {
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [allRevealed, setAllRevealed] = useState(false);
  const [showingPack, setShowingPack] = useState(true);

  useEffect(() => {
    if (open) {
      // Reset state when opening
      setRevealedCards(new Set());
      setAllRevealed(false);
      setShowingPack(true);

      // Start pack opening animation after a short delay
      const packTimer = setTimeout(() => {
        setShowingPack(false);
      }, 1500);

      return () => clearTimeout(packTimer);
    }
  }, [open, cardIds]);

  const handleRevealCard = (index: number) => {
    if (revealedCards.has(index)) return;
    
    const newRevealed = new Set(revealedCards);
    newRevealed.add(index);
    setRevealedCards(newRevealed);

    if (newRevealed.size === cardIds.length) {
      setAllRevealed(true);
    }
  };

  const handleRevealAll = () => {
    const allIndices = new Set(cardIds.map((_, i) => i));
    setRevealedCards(allIndices);
    setAllRevealed(true);
  };

  // Slam rarity card IDs - mega rare pulls
  const SLAM_CARD_IDS = [82, 171, 175, 229, 238, 249, 302, 323, 354, 404, 438, 455];

  const isSlam = (cardId: number) => SLAM_CARD_IDS.includes(cardId);

  const getRarityColor = (rarity: string, cardId: number) => {
    if (isSlam(cardId)) {
      return "from-pink-500 via-red-500 to-orange-500";
    }
    switch (rarity?.toUpperCase()) {
      case "VERY RARE":
        return "from-yellow-400 via-amber-500 to-orange-500";
      case "RARE":
        return "from-purple-400 via-violet-500 to-purple-600";
      case "UNCOMMON":
        return "from-blue-400 via-cyan-500 to-blue-600";
      default:
        return "from-gray-400 via-slate-500 to-gray-600";
    }
  };

  const getRarityGlow = (rarity: string, cardId: number) => {
    if (isSlam(cardId)) {
      return "shadow-[0_0_40px_rgba(255,0,128,0.9)] animate-pulse";
    }
    switch (rarity?.toUpperCase()) {
      case "VERY RARE":
        return "shadow-[0_0_30px_rgba(251,191,36,0.6)]";
      case "RARE":
        return "shadow-[0_0_25px_rgba(168,85,247,0.5)]";
      case "UNCOMMON":
        return "shadow-[0_0_20px_rgba(34,211,238,0.4)]";
      default:
        return "shadow-lg";
    }
  };

  const getRarityLabel = (rarity: string, cardId: number) => {
    if (isSlam(cardId)) return "SLAM";
    return rarity || "Common";
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-background to-background/95 border-primary/20">
        {showingPack ? (
          // Pack opening animation
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative animate-bounce">
              <div className="w-40 h-56 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-xl shadow-2xl flex items-center justify-center border-2 border-primary/30">
                <Sparkles className="w-16 h-16 text-primary-foreground animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-xl" />
              
              {/* Particle effects */}
              <div className="absolute -inset-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                    style={{
                      top: `${20 + Math.random() * 60}%`,
                      left: `${10 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: "1s",
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-6 text-lg font-semibold text-foreground animate-pulse">
              Opening Pack...
            </p>
          </div>
        ) : (
          // Card reveal phase
          <div className="py-4">
            <h2 className="text-2xl font-bold text-center text-foreground mb-6">
              {allRevealed ? "You Got:" : "Click cards to reveal!"}
            </h2>

            <div className={cn(
              "grid gap-4 justify-items-center",
              cardIds.length <= 2 ? "grid-cols-2" : 
              cardIds.length <= 4 ? "grid-cols-2 md:grid-cols-4" : 
              "grid-cols-2 md:grid-cols-3"
            )}>
              {cardIds.map((cardId, index) => {
                const card = getCardById(cardId);
                const isRevealed = revealedCards.has(index);

                return (
                  <div
                    key={index}
                    className="perspective-1000 w-full max-w-[140px]"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div
                      className={cn(
                        "relative w-full aspect-[2/3] cursor-pointer transition-transform duration-700 transform-style-preserve-3d",
                        isRevealed ? "rotate-y-180" : "hover:scale-105"
                      )}
                      onClick={() => handleRevealCard(index)}
                    >
                      {/* Card Back */}
                      <div
                        className={cn(
                          "absolute inset-0 backface-hidden rounded-lg overflow-hidden",
                          "bg-gradient-to-br from-primary via-primary/80 to-primary/60",
                          "border-2 border-primary/30 shadow-xl",
                          "flex items-center justify-center",
                          !isRevealed && "animate-pulse"
                        )}
                      >
                        <div className="text-center">
                          <Sparkles className="w-10 h-10 text-primary-foreground mx-auto mb-2" />
                          <span className="text-sm font-medium text-primary-foreground">
                            Tap to Reveal
                          </span>
                        </div>
                      </div>

                      {/* Card Front */}
                      <div
                        className={cn(
                          "absolute inset-0 backface-hidden rotate-y-180 rounded-lg overflow-hidden",
                          isRevealed && getRarityGlow(card?.rarity || "", cardId)
                        )}
                      >
                        {card && (
                          <>
                            <img
                              src={`/cards/${card.id}.jpg`}
                              alt={card.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                            <div
                              className={cn(
                                "absolute bottom-0 left-0 right-0 py-1 px-2 text-center",
                                "bg-gradient-to-r",
                                getRarityColor(card.rarity, cardId)
                              )}
                            >
                              <p className="text-xs font-bold text-white truncate">
                                {card.title}
                              </p>
                              <p className="text-[10px] text-white/80">
                                {getRarityLabel(card.rarity, cardId)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-6 justify-center">
              {!allRevealed && (
                <Button variant="outline" onClick={handleRevealAll}>
                  Reveal All
                </Button>
              )}
              <Button onClick={onClose} disabled={!allRevealed}>
                {allRevealed ? "Awesome!" : "Reveal cards first"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
