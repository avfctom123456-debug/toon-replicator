import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { useProfile } from "@/hooks/useProfile";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useCardWins } from "@/hooks/useCardWins";
import { CardInfoModal } from "@/components/game/CardInfoModal";
import { ClassicDeckSelect } from "@/components/game/ClassicDeckSelect";
import { ClassicLoadingScreen } from "@/components/game/ClassicLoadingScreen";
import { ClassicGameScreen } from "@/components/game/ClassicGameScreen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  GameState,
  PlacedCard,
  GameCard,
  createPlayerState,
  getMainColors,
  checkCancellations,
  applyPowers,
  calculateScores,
  determineWinner,
  refillHand,
} from "@/lib/gameEngine";
import { supabase } from "@/integrations/supabase/client";

type GamePhase = "deck-select" | "searching" | "loading" | "playing";
type RevealPhase = "placing" | "revealing" | "revealed";

const PlayPVP = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { getDecksWithSlots, loading: decksLoading } = useDecks();
  const { profile, updateCoins, refetchProfile } = useProfile();
  const { updatePvpStats, updateGameStats } = usePlayerStats();
  const { incrementCardWins } = useCardWins();
  const { 
    status: matchmakingStatus, 
    match, 
    matchId, 
    joinQueue, 
    leaveQueue,
    setReady,
    isPlayer1,
    searchTime 
  } = useMatchmaking();

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
  const [opponentProfile, setOpponentProfile] = useState<{ username: string } | null>(null);
  const [loadingGameState, setLoadingGameState] = useState<GameState | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [rewardsProcessed, setRewardsProcessed] = useState(false);

  const PVP_WIN_COINS = 25;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Reveal sequence - same as CPU mode
  const performReveal = useCallback((gameState: GameState, isRound1: boolean) => {
    setRevealPhase("revealing");
    setRevealedSlots([]);
    
    const slotIndices = isRound1 ? [0, 1, 2, 3] : [4, 5, 6];
    
    // Apply all effects to calculate final points
    let finalState = checkCancellations(gameState);
    finalState = applyPowers(finalState);
    
    // Create alternating reveal sequence: P1 slot 0, P2 slot 0, P1 slot 1, P2 slot 1...
    const revealSequence: number[] = [];
    slotIndices.forEach(slot => {
      revealSequence.push(slot);        // Player slot (positive)
      revealSequence.push(-(slot + 1)); // Opponent slot (negative)
    });
    
    let runningPlayerScore = game?.player.totalPoints || 0;
    let runningOpponentScore = game?.opponent.totalPoints || 0;
    
    revealSequence.forEach((slotCode, index) => {
      setTimeout(() => {
        setRevealedSlots(prev => [...prev, slotCode]);
        
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
        
        setGame(prev => {
          if (!prev) return prev;
          
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
          
          const newPlayerColorCounts: Record<string, number> = { ...prev.player.colorCounts };
          const newOppColorCounts: Record<string, number> = { ...prev.opponent.colorCounts };
          
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
        
        if (index === revealSequence.length - 1) {
          setTimeout(() => {
            let newState = calculateScores(finalState);
            
            setTimeout(() => {
              setEffectAnimations([]);
              setPermanentRevealedSlots(prev => [...prev, ...slotIndices]);
              
              if (isRound1) {
                newState = refillHand(newState);
                setGame({ ...newState, phase: "round2-place" });
                setMessage("Round 2: Place 3 more cards");
                setRevealPhase("placing");
                setRevealedSlots([]);
                setTimeLeft(60);
                setWaitingForOpponent(false);
              } else {
                newState = determineWinner(newState);
                setGame({ ...newState, phase: "game-over" });
                setRevealPhase("revealed");
                setShowResultModal(true);
                
                // Process rewards and stats
                if (match && user && !rewardsProcessed) {
                  setRewardsProcessed(true);
                  const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
                  
                  // Track game-specific achievements
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
                  
                  updateGameStats({
                    score: playerScore,
                    isColorWin: newState.winner === "player" && isColorWin,
                    isPerfectWin,
                    cardPlays,
                    cardBuffs,
                    cardCancels,
                    adjacencyPlays,
                  });
                  
                  if (newState.winner === "player") {
                    // Winner gets coins and stats update
                    updatePvpStats(user.id, opponentId, false);
                    const newCoins = (profile?.coins || 0) + PVP_WIN_COINS;
                    updateCoins(newCoins);
                    toast.success(`+${PVP_WIN_COINS} coins for winning!`);
                    setMessage(`You win by ${newState.winMethod}! +${PVP_WIN_COINS} coins`);
                    
                    // Track wins with specific cards for achievements
                    const winningCardIds = newState.player.board
                      .filter((c): c is PlacedCard => c !== null)
                      .map(c => c.card.id);
                    if (winningCardIds.length > 0) {
                      incrementCardWins(winningCardIds);
                    }
                  } else if (newState.winner === "opponent") {
                    // Loser updates stats only
                    updatePvpStats(opponentId, user.id, false);
                    setMessage(`Opponent wins by ${newState.winMethod}!`);
                  } else {
                    // Draw
                    updatePvpStats(user.id, opponentId, true);
                    setMessage("It's a tie!");
                  }
                }
              }
            }, 800);
          }, 300);
        }
      }, index * 1200);
    });
  }, [game]);

  // Handle matchmaking status changes
  useEffect(() => {
    if (matchmakingStatus === 'matched' && match && gamePhase === "searching") {
      // Fetch opponent profile
      const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
      supabase
        .from('profiles')
        .select('username')
        .eq('user_id', opponentId)
        .single()
        .then(({ data }) => {
          if (data) setOpponentProfile(data);
        });

      // Initialize game from match data
      const myDeck = isPlayer1 ? match.player1_deck : match.player2_deck;
      const opponentDeck = isPlayer1 ? match.player2_deck : match.player1_deck;

      const playerState = createPlayerState(myDeck);
      const opponentState = createPlayerState(opponentDeck);
      const mainColors = getMainColors(playerState, opponentState);

      const initialGame: GameState = {
        phase: "round1-place",
        player: playerState,
        opponent: opponentState,
        mainColors,
        winner: null,
        winMethod: null,
        round2FlipIndex: 0,
      };

      setLoadingGameState(initialGame);
      setGamePhase("loading");

      // Show loading screen for 3 seconds, then start
      setTimeout(() => {
        setGame(initialGame);
        setMessage("Round 1: Place 4 cards");
        setTimeLeft(60);
        setRevealPhase("placing");
        setRevealedSlots([]);
        setPermanentRevealedSlots([]);
        setGamePhase("playing");
      }, 3000);
    }
  }, [matchmakingStatus, match, isPlayer1, gamePhase]);

  // Listen for opponent ready and board updates
  useEffect(() => {
    if (!match || !game || gamePhase !== "playing") return;

    const opponentReady = isPlayer1 ? match.player2_ready : match.player1_ready;
    const myReady = isPlayer1 ? match.player1_ready : match.player2_ready;
    
    // When both players ready, start reveal
    if (opponentReady && myReady && waitingForOpponent && revealPhase === "placing") {
      // Get opponent's board from game_state
      const gameStateData = match.game_state as Record<string, unknown>;
      const opponentBoard = gameStateData?.[isPlayer1 ? 'player2_board' : 'player1_board'] as (PlacedCard | null)[] | undefined;
      
      if (opponentBoard) {
        setGame(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            opponent: {
              ...prev.opponent,
              board: opponentBoard,
            }
          };
        });

        // Start reveal with updated game state
        const isRound1 = game.phase === "round1-place";
        const updatedGame = {
          ...game,
          opponent: {
            ...game.opponent,
            board: opponentBoard,
          }
        };
        
        setMessage("Revealing cards...");
        setWaitingForOpponent(false);
        
        // Small delay to ensure state is updated
        setTimeout(() => {
          performReveal(updatedGame, isRound1);
        }, 100);
      }
    }
  }, [match, game, isPlayer1, waitingForOpponent, revealPhase, performReveal, gamePhase]);

  const decks = getDecksWithSlots();

  // Deck selection timer
  useEffect(() => {
    if (gamePhase !== "deck-select") return;
    
    const timer = setInterval(() => {
      setDeckSelectTimer((prev) => {
        if (prev <= 1) {
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

  // Game timer
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

  const handleDeckSelect = useCallback(async (deckCardIds: number[]) => {
    if (deckCardIds.length < 12) {
      setMessage("Deck must have 12 cards!");
      return;
    }

    setSelectedDeck(deckCardIds);
    setGamePhase("searching");
    
    // Join matchmaking queue
    await joinQueue(deckCardIds);
  }, [joinQueue]);

  const cancelSearch = useCallback(async () => {
    await leaveQueue();
    setGamePhase("deck-select");
  }, [leaveQueue]);

  const placeCard = async (slotIndex: number) => {
    if (!game || !selectedHandCard || !matchId) return;
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

  const confirmPlacement = async () => {
    if (!game || !matchId || revealPhase !== "placing") return;

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

    // Sync board to match
    const gameStateUpdate = {
      ...(match?.game_state as Record<string, unknown> || {}),
      [isPlayer1 ? 'player1_board' : 'player2_board']: game.player.board,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('matches')
      .update({ game_state: gameStateUpdate as any })
      .eq('id', matchId);

    // Mark ready
    await setReady();
    setMessage("Waiting for opponent...");
    setWaitingForOpponent(true);
  };

  const resetGame = useCallback(async () => {
    await leaveQueue();
    setGame(null);
    setSelectedDeck(null);
    setGamePhase("deck-select");
    setRevealPhase("placing");
    setRevealedSlots([]);
    setPermanentRevealedSlots([]);
    setEffectAnimations([]);
    setShowResultModal(false);
    setDeckSelectTimer(60);
    setTimeLeft(60);
    setWaitingForOpponent(false);
    setOpponentProfile(null);
    setLoadingGameState(null);
    setRewardsProcessed(false);
    refetchProfile();
  }, [leaveQueue, refetchProfile]);

  if (authLoading || decksLoading) {
    return (
      <div className="min-h-screen bg-[hsl(210,50%,15%)] flex items-center justify-center">
        <div className="text-[hsl(200,50%,70%)] text-xl">Loading...</div>
      </div>
    );
  }

  // Deck Selection
  if (gamePhase === "deck-select") {
    return (
      <ClassicDeckSelect
        decks={decks}
        onSelectDeck={handleDeckSelect}
        timeLeft={deckSelectTimer}
        message="Select a deck for PVP"
      />
    );
  }

  // Searching for opponent
  if (gamePhase === "searching") {
    return (
      <div className="min-h-screen bg-[hsl(210,50%,15%)] flex items-center justify-center">
        <div className="bg-gradient-to-b from-[hsl(200,25%,80%)] to-[hsl(200,30%,70%)] rounded-lg p-8 text-center shadow-2xl">
          <div className="animate-pulse mb-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[hsl(200,50%,50%)] flex items-center justify-center">
              <span className="text-white text-2xl">🔍</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[hsl(200,50%,25%)] mb-2">
            Searching for opponent...
          </h2>
          <p className="text-[hsl(200,40%,35%)] mb-4">
            Time: {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, '0')}
          </p>
          <Button
            onClick={cancelSearch}
            variant="secondary"
            className="bg-[hsl(200,30%,60%)] hover:bg-[hsl(200,30%,55%)] text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Loading screen
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
        status={`vs ${opponentProfile?.username || 'Opponent'}`}
      />
    );
  }

  if (!game) return null;

  // Determine opponent status for UI
  const getOpponentStatus = (): "placing" | "ready" | null => {
    if (!match || revealPhase !== "placing") return null;
    const opponentReady = isPlayer1 ? match.player2_ready : match.player1_ready;
    return opponentReady ? "ready" : "placing";
  };

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
        opponentName={opponentProfile?.username || "Opponent"}
        opponentStatus={getOpponentStatus()}
      />

      <CardInfoModal placedCard={viewingCard} onClose={() => setViewingCard(null)} />
    </>
  );
};

export default PlayPVP;
