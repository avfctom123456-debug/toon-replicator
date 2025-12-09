import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { CardDisplay } from "@/components/CardDisplay";
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerSidebar } from "@/components/game/PlayerSidebar";
import { CardHand } from "@/components/game/CardHand";
import { SelectedCardPreview } from "@/components/game/SelectedCardPreview";
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
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Timer effect
  useEffect(() => {
    if (!game || game.phase === "game-over") return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          confirmPlacement();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game?.phase]);

  const decks = getDecksWithSlots();

  const startGame = (deckCardIds: number[]) => {
    if (deckCardIds.length < 12) {
      setMessage("Deck must have 12 cards!");
      return;
    }
    const initialState = initializeGame(deckCardIds);
    const withAI = aiPlaceCards(initialState, 4, 0);
    setGame(withAI);
    setSelectedDeck(deckCardIds);
    setMessage("Round 1: Place 4 cards on the board");
    setTimeLeft(60);
  };

  const placeCard = (slotIndex: number) => {
    if (!game || !selectedHandCard) return;
    if (game.phase !== "round1-place" && game.phase !== "round2-place") return;
    
    const maxSlot = game.phase === "round1-place" ? 4 : 7;
    const minSlot = game.phase === "round1-place" ? 0 : 4;
    
    if (slotIndex < minSlot || slotIndex >= maxSlot) return;
    if (game.player.board[slotIndex] !== null) return;
    
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
      position: slotIndex,
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
    
    let newState = checkCancellations(game);
    newState = applyPowers(newState);
    newState = calculateScores(newState);
    
    if (game.phase === "round1-place") {
      newState = refillHand(newState);
      newState = aiPlaceCards(newState, 3, 4);
      setGame({ ...newState, phase: "round2-place" });
      setMessage("Round 2: Place 3 more cards");
      setTimeLeft(60);
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
    setTimeLeft(60);
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
              {deck.name} ({deck.filled}/12 cards)
            </Button>
          ))}
        </div>
        
        <Button variant="ghost" className="mt-6" onClick={() => navigate("/home")}>
          Back to Home
        </Button>
        
        <div className="fixed bottom-4 left-4 text-muted-foreground text-xs">v0.0.40</div>
      </div>
    );
  }

  const requiredCards = game.phase === "round1-place" ? 4 : 3;
  const placedCount = game.player.board.filter((s, i) => {
    if (game.phase === "round1-place") return i < 4 && s !== null;
    return i >= 4 && s !== null;
  }).length;

  // Game screen with new layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar - Player Stats */}
      <PlayerSidebar
        playerLabel="Computer"
        playerPoints={game.opponent.totalPoints}
        playerColorCounts={game.opponent.colorCounts}
        mainColors={game.mainColors}
        isOpponent
        opponentLabel="You"
        opponentPoints={game.player.totalPoints}
        opponentColorCounts={game.player.colorCounts}
        onQuit={resetGame}
      />

      {/* Center Game Area */}
      <div className="flex-1 flex flex-col p-2">
        <GameBoard
          opponentBoard={game.opponent.board}
          playerBoard={game.player.board}
          phase={game.phase}
          selectedHandCard={selectedHandCard}
          onPlaceCard={placeCard}
          message={message}
          timeLeft={timeLeft}
          requiredCards={requiredCards}
        />

        {/* Action Button */}
        <div className="flex justify-center mt-2">
          {game.phase === "game-over" ? (
            <Button variant="menu" onClick={resetGame}>Play Again</Button>
          ) : (
            <Button 
              variant="menu" 
              onClick={confirmPlacement}
              disabled={placedCount < requiredCards}
            >
              Ready ({placedCount}/{requiredCards})
            </Button>
          )}
        </div>
      </div>

      {/* Right Sidebar - Card Hand & Preview */}
      <div className="w-48 bg-card/50 border-l border-border flex flex-col">
        <SelectedCardPreview card={selectedHandCard} />
        <CardHand
          cards={game.player.hand}
          selectedCard={selectedHandCard}
          onSelectCard={setSelectedHandCard}
        />
      </div>

      <div className="fixed bottom-2 left-2 text-muted-foreground text-xs">v0.0.40</div>
    </div>
  );
};

export default PlayComputer;
