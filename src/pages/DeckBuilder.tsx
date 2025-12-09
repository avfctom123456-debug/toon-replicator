import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";
import { useDecks } from "@/hooks/useDecks";
import { useAuth } from "@/hooks/useAuth";

const DeckBuilder = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { getDecksWithSlots, loading } = useDecks();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const decks = getDecksWithSlots();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      {/* Logo */}
      <div className="mb-6">
        <img 
          src={gtoonsLogo} 
          alt="gTOONS Remastered" 
          className="w-48 md:w-64 h-auto"
        />
      </div>

      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6 self-start max-w-4xl w-full mx-auto">
        Deck Builder
      </h1>

      {/* Deck Slots */}
      <div className="flex flex-col gap-3 w-full max-w-4xl mb-8">
        {loading ? (
          <div className="text-center text-muted-foreground">Loading decks...</div>
        ) : (
          decks.map((deck) => (
            <div 
              key={deck.slot}
              className="bg-card rounded flex items-center px-4 py-3 gap-3"
            >
              <span className="text-2xl font-bold text-accent w-8">{deck.slot}</span>
              <div className="flex-1">
                <div className="text-foreground font-medium text-sm mb-1">{deck.name}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={i}
                      className={`h-2 flex-1 rounded-sm ${
                        i < deck.filled ? "bg-primary/70" : "bg-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/deck-edit", { state: { deckSlot: deck.slot, cardIds: deck.cardIds } })}
                className="text-foreground"
              >
                Edit
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Home Button */}
      <Button 
        variant="secondary"
        className="mt-8"
        onClick={() => navigate("/home")}
      >
        Home
      </Button>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">
        v0.0.38
      </div>
    </div>
  );
};

export default DeckBuilder;