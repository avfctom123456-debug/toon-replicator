import { useNavigate, useLocation } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";

const decks = [
  { id: "A", filled: 10 },
  { id: "B", filled: 8 },
  { id: "C", filled: 12 },
  { id: "D", filled: 5 },
];

const DeckBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";

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

      {/* Deck Slots */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {decks.map((deck) => (
          <div 
            key={deck.id}
            className="bg-card rounded flex items-center px-4 py-3 gap-4"
          >
            <span className="text-2xl font-bold text-accent w-8">{deck.id}</span>
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
              onClick={() => navigate("/deck-edit", { state: { username, deckId: deck.id } })}
              className="text-foreground"
            >
              Edit
            </Button>
          </div>
        ))}
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
        v0.0.36
      </div>
    </div>
  );
};

export default DeckBuilder;
