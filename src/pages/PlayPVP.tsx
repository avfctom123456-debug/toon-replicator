import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import cardsData from "@/data/cards.json";
import { useAuth } from "@/hooks/useAuth";
import { useDecks } from "@/hooks/useDecks";
import { useProfile } from "@/hooks/useProfile";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import { CardInfoModal } from "@/components/game/CardInfoModal";
import { ClassicDeckSelect } from "@/components/game/ClassicDeckSelect";
import { ClassicLoadingScreen } from "@/components/game/ClassicLoadingScreen";
import { ClassicGameScreen } from "@/components/game/ClassicGameScreen";
import { Button } from "@/components/ui/button";
import {
  GameState,
  PlacedCard,
  GameCard,
  getCardById,
  shuffleArray,
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
  const { profile } = useProfile();
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Handle matchmaking status changes
  useEffect(() => {
    if (matchmakingStatus === 'matched' && match) {
      setGamePhase("loading");
      
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

      // Wait for loading screen then start
      setTimeout(() => {
        setGame(initialGame);
        setMessage("Round 1: Place 4 cards");
        setTimeLeft(60);
        setRevealPhase("placing");
        setGamePhase("playing");
      }, 3000);
    }
  }, [matchmakingStatus, match, isPlayer1]);

  // Sync game state with match
  useEffect(() => {
    if (!match || !game || gamePhase !== "playing") return;

    // Listen for opponent moves via game_state updates
    const gameStateFromMatch = match.game_state as Record<string, unknown>;
    
    if (gameStateFromMatch && Object.keys(gameStateFromMatch).length > 0) {
      // Update opponent's board from match state
      const opponentBoard = gameStateFromMatch[isPlayer1 ? 'player2_board' : 'player1_board'] as (PlacedCard | null)[] | undefined;
      
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
      }
    }
  }, [match?.game_state, isPlayer1, gamePhase]);

  const decks = getDecksWithSlots();

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

    const newGame = {
      ...game,
      player: {
        ...game.player,
        hand: newHand,
        board: newBoard,
      },
    };

    setGame(newGame);
    setSelectedHandCard(null);

    // Sync to match - cast for Supabase types
    const gameStateUpdate = {
      ...(match?.game_state as Record<string, unknown> || {}),
      [isPlayer1 ? 'player1_board' : 'player2_board']: newBoard,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('matches')
      .update({ game_state: gameStateUpdate as any })
      .eq('id', matchId);
  };

  const confirmPlacement = async () => {
    if (!game || !matchId) return;

    const isRound1 = game.phase === "round1-place";
    const requiredCards = isRound1 ? 4 : 3;
    const slotRange = isRound1 ? [0, 1, 2, 3] : [4, 5, 6];

    const placedCount = slotRange.filter(i => game.player.board[i] !== null).length;

    if (placedCount < requiredCards) {
      setMessage(`Place ${requiredCards - placedCount} more card${requiredCards - placedCount > 1 ? "s" : ""}!`);
      return;
    }

    // Mark ready
    await setReady();
    setMessage("Waiting for opponent...");
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
  }, [leaveQueue]);

  if (authLoading || decksLoading) {
    return (
      <div className="min-h-screen bg-[hsl(210,50%,15%)] flex items-center justify-center">
        <div className="text-[hsl(200,50%,70%)] text-xl">Loading...</div>
      </div>
    );
  }

  // Deck Selection
  if (gamePhase === "deck-select") {
    const handleRandomDeck = () => {
      const validDecks = decks.filter(d => d.filled >= 12);
      if (validDecks.length > 0) {
        const randomDeck = validDecks[Math.floor(Math.random() * validDecks.length)];
        handleDeckSelect(randomDeck.cardIds);
      }
    };

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
  if (gamePhase === "loading" && match) {
    const myDeck = isPlayer1 ? match.player1_deck : match.player2_deck;
    const opponentDeck = isPlayer1 ? match.player2_deck : match.player1_deck;
    
    const playerState = createPlayerState(myDeck);
    const opponentState = createPlayerState(opponentDeck);

    if (!playerState.bottomCard || !opponentState.bottomCard) return null;

    return (
      <ClassicLoadingScreen
        playerCard={playerState.bottomCard}
        opponentCard={opponentState.bottomCard}
        playerName={profile?.username || "Player"}
        mainColors={getMainColors(playerState, opponentState)}
        status={`vs ${opponentProfile?.username || 'Opponent'}`}
      />
    );
  }

  if (!game) return null;

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

      <CardInfoModal placedCard={viewingCard} onClose={() => setViewingCard(null)} />
    </>
  );
};

export default PlayPVP;
