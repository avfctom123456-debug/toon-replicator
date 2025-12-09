import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameState } from "@/lib/gameEngine";

const colorDotClasses: Record<string, string> = {
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

interface MobileGameHeaderProps {
  game: GameState;
  message: string;
  timeLeft: number;
  revealPhase: string;
  onQuit: () => void;
}

export const MobileGameHeader = ({
  game,
  message,
  timeLeft,
  revealPhase,
  onQuit,
}: MobileGameHeaderProps) => {
  return (
    <div className="lg:hidden bg-card/80 border-b border-border p-2">
      <div className="flex items-center justify-between gap-2">
        {/* Opponent Stats */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">AI:</span>
          <span className="font-bold text-foreground">{game.opponent.totalPoints}</span>
          <div className="flex gap-1">
            {game.mainColors.map((color) => (
              <div key={color} className="flex items-center gap-0.5">
                <div className={`w-2 h-2 rounded-full ${colorDotClasses[color]}`} />
                <span className="text-[10px] text-muted-foreground">
                  {game.opponent.colorCounts[color] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* VS */}
        <span className="text-muted-foreground text-xs font-bold">VS</span>

        {/* Player Stats */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex gap-1">
            {game.mainColors.map((color) => (
              <div key={color} className="flex items-center gap-0.5">
                <div className={`w-2 h-2 rounded-full ${colorDotClasses[color]}`} />
                <span className="text-[10px] text-muted-foreground">
                  {game.player.colorCounts[color] || 0}
                </span>
              </div>
            ))}
          </div>
          <span className="font-bold text-foreground">{game.player.totalPoints}</span>
          <span className="text-muted-foreground">You</span>
        </div>

        {/* Quit Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          onClick={onQuit}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
