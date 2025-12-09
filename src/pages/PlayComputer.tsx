import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { CardDisplay } from "@/components/CardDisplay";
import {
  GameState,
  PlacedCard,
  initializeGame,
  aiPlaceCards,
  checkCancellations,
  applyPowers,
  calculateScores,
  determineWinner,
  refillHand,
  GameCard,
} from "@/lib/gameEngine";

const PlayComputer = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { getDecksWithSlots, loading: decksLoading } = useDecks();
  
  const [selectedDeck, setSelectedDeck] = useState<number[] | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<GameCard | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const decks = getDecksWithSlots();

  const startGame = (deckCardIds: number[]) => {
    if (deckCardIds.length < 12) {
      setMessage("Deck must have 12 cards!");
      return;
    }
    const initialState = initializeGame(deckCardIds);
    // AI places 4 cards for round 1
    const withAI = aiPlaceCards(initialState, 4, 0);
    setGame(withAI);
    setSelectedDeck(deckCardIds);
    setMessage("Round 1: Place 4 cards on the board");
  };

  const placeCard = (slotIndex: number) => {
    if (!game || !selectedHandCard) return;
    if (game.phase !== "round1-place" && game.phase !== "round2-place") return;
    
    const maxSlot = game.phase === "round1-place" ? 4 : 7;
    const minSlot = game.phase === "round1-place" ? 0 : 4;
    
    if (slotIndex < minSlot || slotIndex >= maxSlot) return;
    if (game.player.board[slotIndex] !== null) return;
    
    // Check for duplicate characters
    const existingCharacters = game.player.board
      .filter((s): s is PlacedCard => s !== null)
      .map(s => s.card.character);
    
    if (existingCharacters.includes(selectedHandCard.character)) {
      setMessage("Cannot place same character twice!");
      return;
    }
    
    const newBoard = [...game.player.board];
    newBoard[slotIndex] = {
      card: selectedHandCard,
      cancelled: false,
      modifiedPoints: selectedHandCard.points,
    };
    
    const newHand = game.player.hand.filter(c => c.id !== selectedHandCard.id);
    
    setGame({
      ...game,
      player: { ...game.player, board: newBoard, hand: newHand },
    });
    setSelectedHandCard(null);
  };

  const confirmPlacement = () => {
    if (!game) return;
    
    const placedCount = game.player.board.filter((s, i) => {
      if (game.phase === "round1-place") return i < 4 && s !== null;
      return i >= 4 && s !== null;
    }).length;
    
    const requiredCount = game.phase === "round1-place" ? 4 : 3;
    
    if (placedCount < requiredCount) {
      setMessage(`Place ${requiredCount} cards!`);
      return;
    }
    
    // Reveal phase
    let newState = checkCancellations(game);
    newState = applyPowers(newState);
    newState = calculateScores(newState);
    
    if (game.phase === "round1-place") {
      newState = refillHand(newState);
      // AI places for round 2
      newState = aiPlaceCards(newState, 3, 4);
      setGame({ ...newState, phase: "round2-place" });
      setMessage("Round 2: Place 3 more cards");
    } else {
      newState = determineWinner(newState);
      setGame({ ...newState, phase: "game-over" });
      if (newState.winner === "player") {
        setMessage(`You win by ${newState.winMethod}!`);
      } else if (newState.winner === "opponent") {
        setMessage(`AI wins by ${newState.winMethod}!`);
      } else {
        setMessage("It's a tie!");
      }
    }
  };

  const resetGame = () => {
    setGame(null);
    setSelectedDeck(null);
    setSelectedHandCard(null);
    setMessage("");
  };

  if (authLoading || decksLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Deck selection screen
  if (!game) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-4 py-6">
        <div className="mb-4">
          <img src={gtoonsLogo} alt="gTOONS" className="w-40 h-auto" />
        </div>
        
        <h1 className="text-xl font-bold text-foreground mb-4">Select a Deck</h1>
        
        {message && (
          <p className="text-destructive mb-4">{message}</p>
        )}
        
        <div className="flex flex-col gap-3 w-full max-w-md">
          {decks.map((deck) => (
            <Button
              key={deck.slot}
              variant="menu"
              onClick={() => startGame(deck.cardIds)}
              disabled={deck.filled < 12}
            >
              Deck {deck.slot} ({deck.filled}/12 cards)
            </Button>
          ))}
        </div>
        
        <Button variant="ghost" className="mt-6" onClick={() => navigate("/home")}>
          Back to Home
        </Button>
        
        <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">v0.0.39</div>
      </div>
    );
  }

  // Game screen
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      RED: "bg-red-500",
      BLUE: "bg-blue-500",
      GREEN: "bg-green-500",
      YELLOW: "bg-yellow-500",
      ORANGE: "bg-orange-500",
      PURPLE: "bg-purple-500",
      PINK: "bg-pink-500",
      BLACK: "bg-gray-800",
      SILVER: "bg-gray-400",
    };
    return colorMap[color] || "bg-gray-500";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-2">
      {/* Header with main colors */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {game.mainColors.map(color => (
            <div key={color} className={`w-6 h-6 rounded ${getColorClass(color)}`} title={color} />
          ))}
        </div>
        <span className="text-sm text-foreground font-bold">{message}</span>
        <Button variant="ghost" size="sm" onClick={resetGame}>Quit</Button>
      </div>

      {/* Scoreboard */}
      <div className="flex justify-between mb-2 px-2 text-sm">
        <div className="text-foreground">
          <span className="font-bold">You:</span> {game.player.totalPoints}pts
          {game.mainColors.map(c => (
            <span key={c} className="ml-2">{c[0]}: {game.player.colorCounts[c] || 0}</span>
          ))}
        </div>
        <div className="text-muted-foreground">
          <span className="font-bold">AI:</span> {game.opponent.totalPoints}pts
          {game.mainColors.map(c => (
            <span key={c} className="ml-2">{c[0]}: {game.opponent.colorCounts[c] || 0}</span>
          ))}
        </div>
      </div>

      {/* Opponent board */}
      <div className="mb-2">
        <p className="text-xs text-muted-foreground mb-1">Opponent</p>
        <div className="grid grid-cols-7 gap-1">
          {game.opponent.board.map((slot, i) => (
            <div key={i} className="aspect-square">
              {slot ? (
                <div className={`relative ${slot.cancelled ? "opacity-40" : ""}`}>
                  <CardDisplay card={slot.card} size="small" />
                  <span className="absolute bottom-0 right-0 bg-background/80 text-xs px-1 rounded">
                    {slot.modifiedPoints}
                  </span>
                </div>
              ) : (
                <div className="w-full h-full rounded bg-muted/30 border border-dashed border-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Player board */}
      <div className="mb-2">
        <p className="text-xs text-muted-foreground mb-1">Your Board</p>
        <div className="grid grid-cols-7 gap-1">
          {game.player.board.map((slot, i) => {
            const isActive = 
              (game.phase === "round1-place" && i < 4) ||
              (game.phase === "round2-place" && i >= 4);
            
            return (
              <div
                key={i}
                className={`aspect-square ${isActive && selectedHandCard ? "cursor-pointer" : ""}`}
                onClick={() => isActive && placeCard(i)}
              >
                {slot ? (
                  <div className={`relative ${slot.cancelled ? "opacity-40" : ""}`}>
                    <CardDisplay card={slot.card} size="small" />
                    <span className="absolute bottom-0 right-0 bg-background/80 text-xs px-1 rounded">
                      {slot.modifiedPoints}
                    </span>
                  </div>
                ) : (
                  <div className={`w-full h-full rounded border border-dashed ${
                    isActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/30"
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hand */}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-1">Your Hand</p>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {game.player.hand.map(card => (
            <div
              key={card.id}
              className={`flex-shrink-0 cursor-pointer transition-transform ${
                selectedHandCard?.id === card.id ? "ring-2 ring-primary scale-105" : ""
              }`}
              onClick={() => setSelectedHandCard(card)}
            >
              <CardDisplay card={card} size="small" />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 py-2">
        {game.phase === "game-over" ? (
          <Button variant="menu" onClick={resetGame}>Play Again</Button>
        ) : (
          <Button variant="menu" onClick={confirmPlacement}>
            Ready
          </Button>
        )}
      </div>

      <div className="fixed bottom-2 left-2 text-muted-foreground text-xs">v0.0.39</div>
    </div>
  );
};

export default PlayComputer;