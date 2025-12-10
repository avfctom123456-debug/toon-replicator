import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import cardsData from "@/data/cards.json";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { useProfile } from "@/hooks/useProfile";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useCardWins } from "@/hooks/useCardWins";
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
  const { updateCpuWin, updateGameStats } = usePlayerStats();
  const { incrementCardWins } = useCardWins();
  
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
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const performReveal = useCallback((gameState: GameState, isRound1: boolean) => {
    setRevealPhase("revealing");
    setRevealedSlots([]);
    
    const slotIndices = isRound1 ? [0, 1, 2, 3] : [4, 5, 6];
    
    // First, apply all effects to calculate final points (but don't show yet)
    let finalState = checkCancellations(gameState);
    finalState = applyPowers(finalState);
    
    // Create alternating reveal sequence: P1 slot 0, P2 slot 0, P1 slot 1, P2 slot 1...
    const revealSequence: number[] = [];
    slotIndices.forEach(slot => {
      revealSequence.push(slot);        // Player slot (positive)
      revealSequence.push(-(slot + 1)); // Opponent slot (negative, offset by 1 to avoid -0)
    });
    
    // Track running scores during reveal
    let runningPlayerScore = game?.player.totalPoints || 0;
    let runningOpponentScore = game?.opponent.totalPoints || 0;
    
    // Reveal cards one by one alternating P1/P2
    revealSequence.forEach((slotCode, index) => {
      setTimeout(() => {
        setRevealedSlots(prev => [...prev, slotCode]);
        
        // Update game state with the revealed card's points
        const isPlayerSlot = slotCode >= 0;
        const actualSlot = isPlayerSlot ? slotCode : -(slotCode + 1);
        
        if (isPlayerSlot) {
          const playerCard = finalState.player.board[actualSlot];
          if (playerCard && !playerCard.cancelled) {
            runningPlayerScore += playerCard.modifiedPoints;
          }
        } else {
          const oppCard = finalState.opponent.board[actualSlot];
          if (oppCard && !oppCard.cancelled) {
            runningOpponentScore += oppCard.modifiedPoints;
          }
        }
        
        // Update game with running scores and effect indicators
        setGame(prev => {
          if (!prev) return prev;
          
          // Merge finalState boards to show effects on revealed cards
          const newPlayerBoard = prev.player.board.map((slot, i) => {
            if (slotIndices.includes(i)) {
              return finalState.player.board[i];
            }
            return slot;
          });
          const newOppBoard = prev.opponent.board.map((slot, i) => {
            if (slotIndices.includes(i)) {
              return finalState.opponent.board[i];
            }
            return slot;
          });
          
          // Calculate color counts from revealed cards only
          const revealedPlayerSlots = revealSequence.slice(0, index + 1).filter(s => s >= 0);
          const revealedOppSlots = revealSequence.slice(0, index + 1).filter(s => s < 0).map(s => -(s + 1));
          
          const newPlayerColorCounts: Record<string, number> = { ...prev.player.colorCounts };
          const newOppColorCounts: Record<string, number> = { ...prev.opponent.colorCounts };
          
          // Only add color from the just-revealed card
          if (isPlayerSlot) {
            const card = finalState.player.board[actualSlot];
            if (card && !card.cancelled) {
              card.card.colors?.forEach(color => {
                newPlayerColorCounts[color] = (newPlayerColorCounts[color] || 0) + 1;
              });
            }
          } else {
            const card = finalState.opponent.board[actualSlot];
            if (card && !card.cancelled) {
              card.card.colors?.forEach(color => {
                newOppColorCounts[color] = (newOppColorCounts[color] || 0) + 1;
              });
            }
          }
          
          return {
            ...prev,
            player: {
              ...prev.player,
              board: newPlayerBoard,
              totalPoints: runningPlayerScore,
              colorCounts: newPlayerColorCounts,
            },
            opponent: {
              ...prev.opponent,
              board: newOppBoard,
              totalPoints: runningOpponentScore,
              colorCounts: newOppColorCounts,
            },
          };
        });
        
        // Show effect animation on the just-revealed card if it has modified points
        if (isPlayerSlot) {
          const card = finalState.player.board[actualSlot];
          if (card && card.modifiedPoints !== card.card.basePoints) {
            setEffectAnimations(prev => [...prev, actualSlot]);
          }
        } else {
          const card = finalState.opponent.board[actualSlot];
          if (card && card.modifiedPoints !== card.card.basePoints) {
            setEffectAnimations(prev => [...prev, actualSlot + 100]);
          }
        }
        
        // After all cards revealed, finalize
        if (index === revealSequence.length - 1) {
          setTimeout(() => {
            let newState = calculateScores(finalState);
            
            setTimeout(() => {
              setEffectAnimations([]);
              setPermanentRevealedSlots(prev => [...prev, ...slotIndices]);
              
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
                setShowResultModal(true);
                
                // Track achievements when game ends
                const playerScore = newState.player.totalPoints;
                const opponentScore = newState.opponent.totalPoints;
                const isColorWin = newState.winMethod === "color";
                const isPerfectWin = newState.winner === "player" && opponentScore === 0;
                
                // Count card stats for achievements
                const playerCards = newState.player.board.filter(c => c !== null);
                const cardPlays = playerCards.length;
                const cardBuffs = playerCards.filter(c => c && c.modifiedPoints > c.card.basePoints).length;
                const cardCancels = newState.opponent.board.filter(c => c?.cancelled).length;
                
                // Count adjacency plays (cards placed next to other player cards)
                const adjacencyPlays = playerCards.filter((card, idx) => {
                  if (!card) return false;
                  const neighbors = [idx - 1, idx + 1].filter(i => i >= 0 && i < 7);
                  return neighbors.some(i => newState.player.board[i] !== null);
                }).length;
                
                // Update game stats for achievements
                updateGameStats({
                  score: playerScore,
                  isColorWin: newState.winner === "player" && isColorWin,
                  isPerfectWin,
                  cardPlays,
                  cardBuffs,
                  cardCancels,
                  adjacencyPlays,
                });
                
                // Track CPU win and card wins if player won
                if (newState.winner === "player") {
                  updateCpuWin();
                  
                  // Track wins with specific cards for achievements
                  const winningCardIds = newState.player.board
                    .filter((c): c is PlacedCard => c !== null)
                    .map(c => c.card.id);
                  if (winningCardIds.length > 0) {
                    incrementCardWins(winningCardIds);
                  }
                }
                
                if (newState.winner === "player") {
                  setMessage(`You win by ${newState.winMethod}!`);
                } else if (newState.winner === "opponent") {
                  setMessage(`AI wins by ${newState.winMethod}!`);
                } else {
                  setMessage("It's a tie!");
                }
              }
            }, 800);
          }, 300);
        }
      }, index * 1200);
    });
  }, [game]);

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

  const [loadingGameState, setLoadingGameState] = useState<GameState | null>(null);

  const handleDeckSelect = useCallback((deckCardIds: number[]) => {
    if (deckCardIds.length < 12) {
      setMessage("Deck must have 12 cards!");
      return;
    }
    
    setSelectedDeck(deckCardIds);
    
    // Initialize game immediately to get cut cards and main colors
    const initialState = initializeGame(deckCardIds);
    const withAI = aiPlaceCards(initialState, 4, 0);
    setLoadingGameState(withAI);
    setGamePhase("loading");
    
    // Show loading screen for 3 seconds, then start the game
    setTimeout(() => {
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
  if (gamePhase === "loading" && loadingGameState) {
    const playerBottomCard = loadingGameState.player.bottomCard;
    const opponentBottomCard = loadingGameState.opponent.bottomCard;
    
    if (!playerBottomCard || !opponentBottomCard) return null;

    return (
      <ClassicLoadingScreen
        playerCard={playerBottomCard}
        opponentCard={opponentBottomCard}
        playerName={profile?.username || "Player"}
        mainColors={loadingGameState.mainColors}
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
        showResultModal={showResultModal}
        onCloseResultModal={() => setShowResultModal(false)}
      />

      {/* Card Info Modal */}
      <CardInfoModal placedCard={viewingCard} onClose={() => setViewingCard(null)} />
    </>
  );
};

export default PlayComputer;
