import { useState, useEffect } from "react";
import { GameState, PlacedCard, GameCard } from "@/lib/gameEngine";
import { ClassicBoardSlot } from "./ClassicBoardSlot";
import { ClassicPlayerSidebar } from "./ClassicPlayerSidebar";
import { ClassicCardPreview } from "./ClassicCardPreview";
import { ClassicHandGrid } from "./ClassicHandGrid";
import { ClassicGameResultModal } from "./ClassicGameResultModal";

type RevealPhase = "placing" | "revealing" | "revealed";

type OpponentStatus = "placing" | "ready" | null;

interface ClassicGameScreenProps {
  game: GameState;
  selectedHandCard: GameCard | null;
  onSelectCard: (card: GameCard | null) => void;
  onPlaceCard: (slotIndex: number) => void;
  onViewCard: (card: PlacedCard | null) => void;
  onConfirm: () => void;
  onQuit: () => void;
  message: string;
  timeLeft: number;
  revealPhase: RevealPhase;
  revealedSlots: number[];
  permanentRevealedSlots: number[];
  effectAnimations: number[];
  playerName: string;
  showResultModal?: boolean;
  onCloseResultModal?: () => void;
  opponentName?: string;
  opponentStatus?: OpponentStatus;
}

export const ClassicGameScreen = ({
  game,
  selectedHandCard,
  onSelectCard,
  onPlaceCard,
  onViewCard,
  onConfirm,
  onQuit,
  message,
  timeLeft,
  revealPhase,
  revealedSlots,
  permanentRevealedSlots,
  effectAnimations,
  playerName,
  showResultModal = false,
  onCloseResultModal,
  opponentName = "Computer",
  opponentStatus,
}: ClassicGameScreenProps) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (window.innerWidth < 1024) {
        setScale(window.innerWidth / 1024);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const isRound1 = game.phase === "round1-place";
  const isRound2 = game.phase === "round2-place";
  const isPlacing = (isRound1 || isRound2) && revealPhase === "placing";
  const isGameOver = game.phase === "game-over";

  const requiredCards = isRound1 ? 4 : 3;
  const placedCount = game.player.board.filter((s, i) => {
    if (isRound1) return i < 4 && s !== null;
    return i >= 4 && s !== null;
  }).length;

  // During reveal phase, cards flip face-down first, then reveal one by one
  // Player slots: positive, Opponent slots: negative (-(slot+1))
  const isSlotHidden = (slotIndex: number, isOpponent: boolean) => {
    const isCurrentRound = isRound1 ? slotIndex < 4 : slotIndex >= 4;
    
    // Cards from previous rounds are always visible
    if (!isCurrentRound) return false;
    
    // During placing phase, player cards are visible, opponent cards hidden
    if (revealPhase === "placing") {
      return isOpponent;
    }
    
    // During revealing phase, check if this specific slot has been revealed
    if (revealPhase === "revealing") {
      if (isOpponent) {
        return !revealedSlots.includes(-(slotIndex + 1));
      }
      return !revealedSlots.includes(slotIndex);
    }
    
    // After reveal, all cards visible
    return false;
  };

  const isSlotRevealing = (slotIndex: number, isOpponent: boolean) => {
    if (revealPhase !== "revealing") return false;
    const currentSlots = revealedSlots;
    const lastRevealed = currentSlots[currentSlots.length - 1];
    
    if (isOpponent) {
      return lastRevealed === -(slotIndex + 1);
    }
    return lastRevealed === slotIndex;
  };

  const getStatusMessage = () => {
    if (isGameOver) return message;
    if (revealPhase === "revealing") return "Scoring...";
    if (isRound1) return "Play 4 GToons";
    if (isRound2) return "Play 3 GToons";
    return message;
  };

  return (
    <div 
      className="min-h-screen bg-[hsl(212,69%,16%)] overflow-hidden"
      style={{ height: scale < 1 ? `${100 / scale}vh` : 'auto' }}
    >
      <div 
        className="flex flex-col min-h-screen"
        style={{ 
          width: "1024px",
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Top Header Bar */}
        <div className="h-8 bg-[hsl(212,60%,20%)] border-b border-[hsl(212,50%,25%)] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-[hsl(200,40%,70%)] text-sm">🔊</span>
          </div>
          <div className="text-[hsl(200,30%,60%)] text-xs font-mono">
            {playerName}
          </div>
        </div>

        {/* Main Game Container */}
        <div className="flex-1 flex p-2">
          {/* Main Game Panel with 3D Effect */}
          <div 
            className="flex-1 bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,65%)] rounded-xl shadow-2xl overflow-hidden flex"
            style={{
              transform: "perspective(1000px) rotateX(2deg)",
              transformOrigin: "center bottom",
            }}
          >
            {/* Left Sidebar - Player Stats */}
            <ClassicPlayerSidebar
              computerName={opponentName}
              computerPoints={game.opponent.totalPoints}
              computerColorCounts={game.opponent.colorCounts}
              playerName={playerName}
              playerPoints={game.player.totalPoints}
              playerColorCounts={game.player.colorCounts}
              mainColors={game.mainColors}
              onQuit={onQuit}
              opponentStatus={opponentStatus}
            />

            {/* Center - Game Board */}
            <div className="flex-1 flex flex-col">
              {/* Opponent Board Area */}
              <div className="flex-1 bg-[hsl(200,25%,78%)] p-4 flex flex-col justify-end">
              {/* Round 2 row (3 slots) - Top */}
                <div className="flex justify-center gap-4 mb-3">
                  {[4, 5, 6].map((i) => (
                    <ClassicBoardSlot
                      key={`opp-${i}`}
                      slot={game.opponent.board[i]}
                      isHidden={isSlotHidden(i, true)}
                      isRevealing={isSlotRevealing(i, true)}
                      hasEffect={effectAnimations.includes(i + 100)}
                      onViewCard={!isSlotHidden(i, true) && game.opponent.board[i] ? () => onViewCard(game.opponent.board[i]) : undefined}
                    />
                  ))}
                </div>
                {/* Round 1 row (4 slots) - Bottom */}
                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <ClassicBoardSlot
                      key={`opp-${i}`}
                      slot={game.opponent.board[i]}
                      isHidden={isSlotHidden(i, true)}
                      isRevealing={isSlotRevealing(i, true)}
                      hasEffect={effectAnimations.includes(i + 100)}
                      onViewCard={!isSlotHidden(i, true) && game.opponent.board[i] ? () => onViewCard(game.opponent.board[i]) : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* Center Divider with Status */}
              <div className="bg-[hsl(212,60%,25%)] py-2 flex items-center justify-center gap-4">
                <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,30%,70%)] rounded-full px-6 py-2 shadow-lg border border-[hsl(200,40%,90%)] flex items-center gap-4">
                  <span className="text-[hsl(212,60%,25%)] font-bold">
                    {getStatusMessage()}
                  </span>
                  {isPlacing && (
                    <span className="text-[hsl(212,50%,40%)] font-medium">
                      Time Left: {timeLeft}
                    </span>
                  )}
                  {isPlacing && placedCount >= requiredCards && (
                    <button
                      onClick={onConfirm}
                      className="bg-[hsl(200,40%,85%)] hover:bg-[hsl(200,50%,80%)] text-[hsl(212,60%,25%)] font-bold px-4 py-1 rounded-full transition-colors border border-[hsl(200,30%,60%)]"
                    >
                      Ready
                    </button>
                  )}
                  {isGameOver && (
                    <button
                      onClick={onQuit}
                      className="bg-[hsl(200,40%,85%)] hover:bg-[hsl(200,50%,80%)] text-[hsl(212,60%,25%)] font-bold px-4 py-1 rounded-full transition-colors border border-[hsl(200,30%,60%)]"
                    >
                      Play Again
                    </button>
                  )}
                </div>
              </div>

              {/* Player Board Area */}
              <div className="flex-1 bg-[hsl(200,25%,78%)] p-4 flex flex-col justify-start">
                {/* Round 1 row (4 slots) - Top */}
                <div className="flex justify-center gap-4 mb-3">
                  {[0, 1, 2, 3].map((i) => {
                    const isActive = isRound1 && game.player.board[i] === null && revealPhase === "placing";
                    return (
                      <ClassicBoardSlot
                        key={`player-${i}`}
                        slot={game.player.board[i]}
                        isActive={isActive}
                        isClickable={isActive && selectedHandCard !== null}
                        onClick={() => onPlaceCard(i)}
                        isHidden={isSlotHidden(i, false)}
                        isRevealing={isSlotRevealing(i, false)}
                        hasEffect={effectAnimations.includes(i)}
                        onViewCard={!isSlotHidden(i, false) && game.player.board[i] ? () => onViewCard(game.player.board[i]) : undefined}
                      />
                    );
                  })}
                </div>
                {/* Round 2 row (3 slots) - Bottom */}
                <div className="flex justify-center gap-4">
                  {[4, 5, 6].map((i) => {
                    const isActive = isRound2 && game.player.board[i] === null && revealPhase === "placing";
                    return (
                      <ClassicBoardSlot
                        key={`player-${i}`}
                        slot={game.player.board[i]}
                        isActive={isActive}
                        isClickable={isActive && selectedHandCard !== null}
                        onClick={() => onPlaceCard(i)}
                        isHidden={isSlotHidden(i, false)}
                        isRevealing={isSlotRevealing(i, false)}
                        hasEffect={effectAnimations.includes(i)}
                        onViewCard={!isSlotHidden(i, false) && game.player.board[i] ? () => onViewCard(game.player.board[i]) : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Sidebar - Selected Card & Hand */}
            <div 
              className="w-56 bg-gradient-to-b from-[hsl(200,25%,80%)] to-[hsl(200,30%,70%)] flex flex-col border-l border-[hsl(200,30%,60%)]"
              style={{
                transform: "perspective(500px) rotateY(-5deg)",
                transformOrigin: "left center",
              }}
            >
              {/* Selected Card Preview */}
              <div className="flex-1 p-3 flex items-start justify-center">
                <ClassicCardPreview card={selectedHandCard} />
              </div>

              {/* Hand Grid */}
              <div className="p-3 bg-[hsl(200,28%,75%)]">
                <ClassicHandGrid
                  cards={game.player.hand}
                  selectedCard={selectedHandCard}
                  onSelectCard={onSelectCard}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Result Modal */}
      <ClassicGameResultModal
        isOpen={showResultModal && game.phase === "game-over"}
        winner={game.winner || null}
        winMethod={game.winMethod || "Points"}
        playerScore={game.player.totalPoints}
        opponentScore={game.opponent.totalPoints}
        onReview={() => onCloseResultModal?.()}
      />
    </div>
  );
};
