import { useNavigate, useLocation } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";
import { useDecks } from "@/hooks/useDecks";
import { useAuth } from "@/hooks/useAuth";

const DeckBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";
  const { user } = useAuth();
  const { getDecksWithSlots, loading } = useDecks();

  const decks = getDecksWithSlots();

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
      <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6 self-start max-w-md w-full mx-auto">
        Deck Builder
      </h1>

      {!user && (
        <p className="text-muted-foreground mb-4 text-center">
          Sign in to save your decks
        </p>
      )}

      {/* Deck Slots */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {loading ? (
          <div className="text-center text-muted-foreground">Loading decks...</div>
        ) : (
          decks.map((deck) => (
            <div 
              key={deck.slot}
              className="bg-card rounded flex items-center px-4 py-3 gap-4"
            >
              <span className="text-2xl font-bold text-accent w-8">{deck.slot}</span>
              <div className="flex-1 flex gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div 
                    key={i}
                    className={`h-8 flex-1 rounded-sm ${
                      i < deck.filled ? "bg-muted-foreground/60" : "bg-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/deck-edit", { state: { username, deckSlot: deck.slot, cardIds: deck.cardIds } })}
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
        onClick={() => navigate("/home", { state: { username } })}
      >
        Home
      </Button>

      {/* Version */}
      <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">
        v0.0.37
      </div>
    </div>
  );
};

export default DeckBuilder;
