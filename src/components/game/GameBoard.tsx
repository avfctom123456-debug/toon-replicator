import { PlacedCard, GameCard } from "@/lib/gameEngine";
import { BoardSlot } from "./BoardSlot";

interface GameBoardProps {
  opponentBoard: (PlacedCard | null)[];
  playerBoard: (PlacedCard | null)[];
  phase: string;
  selectedHandCard: GameCard | null;
  onPlaceCard: (slotIndex: number) => void;
  message: string;
  timeLeft: number;
  requiredCards: number;
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
}: GameBoardProps) => {
  const isRound1 = phase === "round1-place";
  const isRound2 = phase === "round2-place";
  const isPlacing = isRound1 || isRound2;

  return (
    <div className="flex-1 flex flex-col">
      {/* Opponent's board */}
      <div className="flex-1 bg-secondary/30 rounded-t-xl p-3 border border-border/50">
        {/* Round 1 row (4 slots) */}
        <div className="flex justify-center gap-2 mb-2">
          {[0, 1, 2, 3].map((i) => (
            <BoardSlot
              key={`opp-${i}`}
              slot={opponentBoard[i]}
              isActive={false}
              isClickable={false}
              size="normal"
            />
          ))}
        </div>
        {/* Round 2 row (3 slots, centered) */}
        <div className="flex justify-center gap-2">
          <div className="w-12" /> {/* Spacer for offset */}
          {[4, 5, 6].map((i) => (
            <BoardSlot
              key={`opp-${i}`}
              slot={opponentBoard[i]}
              isActive={false}
              isClickable={false}
              size="normal"
            />
          ))}
          <div className="w-12" /> {/* Spacer for offset */}
        </div>
      </div>

      {/* Center divider with message and timer */}
      <div className="bg-primary/20 border-y border-border py-1 px-4 flex items-center justify-center gap-4">
        <span className="text-sm font-bold text-foreground">{message}</span>
        {isPlacing && (
          <span className="text-xs bg-card px-2 py-0.5 rounded-full text-muted-foreground">
            Time Left: {timeLeft}
          </span>
        )}
      </div>

      {/* Player's board */}
      <div className="flex-1 bg-secondary/50 rounded-b-xl p-3 border border-border/50">
        {/* Round 1 row (4 slots) */}
        <div className="flex justify-center gap-2 mb-2">
          {[0, 1, 2, 3].map((i) => {
            const isActive = isRound1 && playerBoard[i] === null;
            return (
              <BoardSlot
                key={`player-${i}`}
                slot={playerBoard[i]}
                isActive={isActive}
                isClickable={isActive && selectedHandCard !== null}
                onClick={() => onPlaceCard(i)}
                size="normal"
              />
            );
          })}
        </div>
        {/* Round 2 row (3 slots, centered) */}
        <div className="flex justify-center gap-2">
          <div className="w-12" /> {/* Spacer for offset */}
          {[4, 5, 6].map((i) => {
            const isActive = isRound2 && playerBoard[i] === null;
            return (
              <BoardSlot
                key={`player-${i}`}
                slot={playerBoard[i]}
                isActive={isActive}
                isClickable={isActive && selectedHandCard !== null}
                onClick={() => onPlaceCard(i)}
                size="normal"
              />
            );
          })}
          <div className="w-12" /> {/* Spacer for offset */}
        </div>
      </div>
    </div>
  );
};
