import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import cardsData from "@/data/cards.json";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { useProfile } from "@/hooks/useProfile";
import { CardInfoModal } from "@/components/game/CardInfoModal";
import { ClassicDeckSelect } from "@/components/game/ClassicDeckSelect";
import { ClassicLoadingScreen } from "@/components/game/ClassicLoadingScreen";
import { ClassicGameScreen } from "@/components/game/ClassicGameScreen";
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

type RevealPhase = "placing" | "revealing" | "revealed";
type GamePhase = "deck-select" | "loading" | "playing";

const PlayComputer = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { getDecksWithSlots, loading: decksLoading } = useDecks();
  const { profile } = useProfile();
  
  const [gamePhase, setGamePhase] = useState<GamePhase>("deck-select");
  const [selectedDeck, setSelectedDeck] = useState<number[] | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<GameCard | null>(null);
  const [message, setMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [deckSelectTimer, setDeckSelectTimer] = useState(60);
  const [revealPhase, setRevealPhase] = useState<RevealPhase>("placing");
  const [revealedSlots, setRevealedSlots] = useState<number[]>([]);
  const [permanentRevealedSlots, setPermanentRevealedSlots] = useState<number[]>([]);
  const [effectAnimations, setEffectAnimations] = useState<number[]>([]);
  const [viewingCard, setViewingCard] = useState<PlacedCard | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const performReveal = useCallback((gameState: GameState, isRound1: boolean) => {
    setRevealPhase("revealing");
    setRevealedSlots([]);
    
    const slotsToReveal = isRound1 ? [0, 1, 2, 3] : [4, 5, 6];
    
    // Reveal cards one by one
    slotsToReveal.forEach((slot, index) => {
      setTimeout(() => {
        setRevealedSlots(prev => [...prev, slot]);
        
        // After all cards revealed, apply effects
        if (index === slotsToReveal.length - 1) {
          setTimeout(() => {
            let newState = checkCancellations(gameState);
            newState = applyPowers(newState);
            newState = calculateScores(newState);
            
            // Animate effect changes
            const affectedSlots = newState.player.board
              .map((slot, i) => slot && slot.modifiedPoints !== slot.card.basePoints ? i : -1)
              .filter(i => i !== -1);
            
            const oppAffectedSlots = newState.opponent.board
              .map((slot, i) => slot && slot.modifiedPoints !== slot.card.basePoints ? i + 100 : -1)
              .filter(i => i !== -1);
            
            setEffectAnimations([...affectedSlots, ...oppAffectedSlots]);
            
            setTimeout(() => {
              setEffectAnimations([]);
              // Mark these slots as permanently revealed
              setPermanentRevealedSlots(prev => [...prev, ...slotsToReveal]);
              
              if (isRound1) {
                newState = refillHand(newState);
                newState = aiPlaceCards(newState, 3, 4);
                setGame({ ...newState, phase: "round2-place" });
                setMessage("Round 2: Place 3 more cards");
                setRevealPhase("placing");
                setRevealedSlots([]);
                setTimeLeft(60);
              } else {
                newState = determineWinner(newState);
                setGame({ ...newState, phase: "game-over" });
                setRevealPhase("revealed");
                if (newState.winner === "player") {
                  setMessage(`You win by ${newState.winMethod}!`);
                } else if (newState.winner === "opponent") {
                  setMessage(`AI wins by ${newState.winMethod}!`);
                } else {
                  setMessage("It's a tie!");
                }
              }
            }, 1000);
          }, 500);
        }
      }, index * 400);
    });
  }, []);

  const decks = getDecksWithSlots();

  // Deck selection timer
  useEffect(() => {
    if (gamePhase !== "deck-select") return;
    
    const timer = setInterval(() => {
      setDeckSelectTimer((prev) => {
        if (prev <= 1) {
          // Auto-select a random valid deck when time runs out
          const validDecks = decks.filter((d) => d.filled >= 12);
          if (validDecks.length > 0) {
            const randomDeck = validDecks[Math.floor(Math.random() * validDecks.length)];
            handleDeckSelect(randomDeck.cardIds);
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, decks]);

  // Game timer effect
  useEffect(() => {
    if (!game || game.phase === "game-over" || revealPhase !== "placing" || gamePhase !== "playing") return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [game?.phase, revealPhase, gamePhase]);

  const handleDeckSelect = useCallback((deckCardIds: number[]) => {
    if (deckCardIds.length < 12) {
      setMessage("Deck must have 12 cards!");
      return;
    }
    
    setSelectedDeck(deckCardIds);
    setGamePhase("loading");
    
    // Show loading screen for 3 seconds, then start the game
    setTimeout(() => {
      const initialState = initializeGame(deckCardIds);
      const withAI = aiPlaceCards(initialState, 4, 0);
      setGame(withAI);
      setMessage("Round 1: Place 4 cards");
      setTimeLeft(60);
      setRevealPhase("placing");
      setRevealedSlots([]);
      setPermanentRevealedSlots([]);
      setGamePhase("playing");
    }, 3000);
  }, []);

  const placeCard = (slotIndex: number) => {
    if (!game || !selectedHandCard) return;
    if (game.phase !== "round1-place" && game.phase !== "round2-place") return;
    if (revealPhase !== "placing") return;
    
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
    if (!game || revealPhase !== "placing") return;
    
    const isRound1 = game.phase === "round1-place";
    const placedCount = game.player.board.filter((s, i) => {
      if (isRound1) return i < 4 && s !== null;
      return i >= 4 && s !== null;
    }).length;
    
    const requiredCount = isRound1 ? 4 : 3;
    
    if (placedCount < requiredCount) {
      setMessage(`Place ${requiredCount} cards!`);
      return;
    }
    
    setMessage("Revealing cards...");
    performReveal(game, isRound1);
  };

  const resetGame = () => {
    setGamePhase("deck-select");
    setGame(null);
    setSelectedDeck(null);
    setSelectedHandCard(null);
    setMessage("");
    setTimeLeft(60);
    setDeckSelectTimer(60);
    setRevealPhase("placing");
    setRevealedSlots([]);
    setPermanentRevealedSlots([]);
    setEffectAnimations([]);
    setViewingCard(null);
  };

  if (authLoading || decksLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Classic Deck Selection Screen
  if (gamePhase === "deck-select") {
    return (
      <ClassicDeckSelect
        decks={decks}
        timeLeft={deckSelectTimer}
        onSelectDeck={handleDeckSelect}
        message={message}
      />
    );
  }

  // Loading Screen with cut cards reveal
  if (gamePhase === "loading" && selectedDeck) {
    // Get first card from player's deck and a random opponent card for display
    const playerCardData = cardsData.find((c: { id: number }) => c.id === selectedDeck[0]);
    const opponentCardData = cardsData.find((c: { id: number }) => c.id === selectedDeck[1]);
    
    const playerDisplayCard: GameCard = {
      id: playerCardData?.id || 1,
      title: playerCardData?.title || "Card",
      character: playerCardData?.character || "Card",
      basePoints: playerCardData?.basePoints || 5,
      points: playerCardData?.basePoints || 5,
      colors: playerCardData?.colors || ["BLUE"],
      description: playerCardData?.description || "",
      rarity: playerCardData?.rarity || "COMMON",
      groups: playerCardData?.groups || [],
      types: playerCardData?.types || [],
    };
    
    const opponentDisplayCard: GameCard = {
      id: opponentCardData?.id || 2,
      title: opponentCardData?.title || "Card",
      character: opponentCardData?.character || "Card",
      basePoints: opponentCardData?.basePoints || 5,
      points: opponentCardData?.basePoints || 5,
      colors: opponentCardData?.colors || ["RED"],
      description: opponentCardData?.description || "",
      rarity: opponentCardData?.rarity || "COMMON",
      groups: opponentCardData?.groups || [],
      types: opponentCardData?.types || [],
    };

    return (
      <ClassicLoadingScreen
        playerCard={playerDisplayCard}
        opponentCard={opponentDisplayCard}
        playerName={profile?.username || "Player"}
        mainColors={["BLUE", "RED"]}
        status="Selecting Cut Cards"
      />
    );
  }

  if (!game) return null;

  // Classic Game Screen (forced desktop view)
  return (
    <>
      <ClassicGameScreen
        game={game}
        selectedHandCard={selectedHandCard}
        onSelectCard={setSelectedHandCard}
        onPlaceCard={placeCard}
        onViewCard={setViewingCard}
        onConfirm={confirmPlacement}
        onQuit={resetGame}
        message={message}
        timeLeft={timeLeft}
        revealPhase={revealPhase}
        revealedSlots={revealedSlots}
        permanentRevealedSlots={permanentRevealedSlots}
        effectAnimations={effectAnimations}
        playerName={profile?.username || "Player"}
      />

      {/* Card Info Modal */}
      <CardInfoModal placedCard={viewingCard} onClose={() => setViewingCard(null)} />
    </>
  );
};

export default PlayComputer;
