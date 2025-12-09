import { PlacedCard, GameCard } from "@/lib/gameEngine";
import { BoardSlot } from "./BoardSlot";

type RevealPhase = "placing" | "revealing" | "revealed";

interface GameBoardProps {
  opponentBoard: (PlacedCard | null)[];
  playerBoard: (PlacedCard | null)[];
  phase: string;
  selectedHandCard: GameCard | null;
  onPlaceCard: (slotIndex: number) => void;
  message: string;
  timeLeft: number;
  requiredCards: number;
  revealPhase: RevealPhase;
  revealedSlots: number[];
  effectAnimations: number[];
}

export const GameBoard = ({
  opponentBoard,
  playerBoard,
  phase,
  selectedHandCard,
  onPlaceCard,
  message,
  timeLeft,
  requiredCards,
  revealPhase,
  revealedSlots,
  effectAnimations,
}: GameBoardProps) => {
  const isRound1 = phase === "round1-place";
  const isRound2 = phase === "round2-place";
  const isPlacing = (isRound1 || isRound2) && revealPhase === "placing";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Opponent's board */}
      <div className="flex-1 bg-secondary/30 rounded-t-xl p-2 sm:p-3 border border-border/50">
        {/* Round 1 row (4 slots) */}
        <div className="flex justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          {[0, 1, 2, 3].map((i) => (
            <BoardSlot
              key={`opp-${i}`}
              slot={opponentBoard[i]}
              isActive={false}
              isClickable={false}
              isHidden={revealPhase === "placing" || (revealPhase === "revealing" && !revealedSlots.includes(i))}
              isRevealing={revealPhase === "revealing" && revealedSlots.includes(i)}
              hasEffect={effectAnimations.includes(i + 100)}
            />
          ))}
        </div>
        {/* Round 2 row (3 slots, centered) */}
        <div className="flex justify-center gap-1 sm:gap-2">
          <div className="w-6 sm:w-12" />
          {[4, 5, 6].map((i) => (
            <BoardSlot
              key={`opp-${i}`}
              slot={opponentBoard[i]}
              isActive={false}
              isClickable={false}
              isHidden={revealPhase === "placing" || (revealPhase === "revealing" && !revealedSlots.includes(i))}
              isRevealing={revealPhase === "revealing" && revealedSlots.includes(i)}
              hasEffect={effectAnimations.includes(i + 100)}
            />
          ))}
          <div className="w-6 sm:w-12" />
        </div>
      </div>

      {/* Center divider with message and timer */}
      <div className="bg-primary/20 border-y border-border py-1 px-2 sm:px-4 flex items-center justify-center gap-2 sm:gap-4">
        <span className="text-xs sm:text-sm font-bold text-foreground truncate">{message}</span>
        {isPlacing && (
          <span className="text-[10px] sm:text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground whitespace-nowrap">
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Player's board */}
      <div className="flex-1 bg-secondary/50 rounded-b-xl p-2 sm:p-3 border border-border/50">
        {/* Round 1 row (4 slots) */}
        <div className="flex justify-center gap-1 sm:gap-2 mb-1 sm:mb-2">
          {[0, 1, 2, 3].map((i) => {
            const isActive = isRound1 && playerBoard[i] === null && revealPhase === "placing";
            return (
              <BoardSlot
                key={`player-${i}`}
                slot={playerBoard[i]}
                isActive={isActive}
                isClickable={isActive && selectedHandCard !== null}
                onClick={() => onPlaceCard(i)}
                hasEffect={effectAnimations.includes(i)}
              />
            );
          })}
        </div>
        {/* Round 2 row (3 slots, centered) */}
        <div className="flex justify-center gap-1 sm:gap-2">
          <div className="w-6 sm:w-12" />
          {[4, 5, 6].map((i) => {
            const isActive = isRound2 && playerBoard[i] === null && revealPhase === "placing";
            return (
              <BoardSlot
                key={`player-${i}`}
                slot={playerBoard[i]}
                isActive={isActive}
                isClickable={isActive && selectedHandCard !== null}
                onClick={() => onPlaceCard(i)}
                hasEffect={effectAnimations.includes(i)}
              />
            );
          })}
          <div className="w-6 sm:w-12" />
        </div>
      </div>
    </div>
  );
};
