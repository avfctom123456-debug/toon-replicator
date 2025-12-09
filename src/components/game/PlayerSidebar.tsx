import { Button } from "@/components/ui/button";

interface PlayerSidebarProps {
  playerLabel: string;
  playerPoints: number;
  playerColorCounts: Record<string, number>;
  mainColors: string[];
  isOpponent?: boolean;
  opponentLabel?: string;
  opponentPoints?: number;
  opponentColorCounts?: Record<string, number>;
  onQuit?: () => void;
}

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

export const PlayerSidebar = ({
  playerLabel,
  playerPoints,
  playerColorCounts,
  mainColors,
  isOpponent,
  opponentLabel,
  opponentPoints,
  opponentColorCounts,
  onQuit,
}: PlayerSidebarProps) => {
  return (
    <div className="w-32 bg-card/80 border-r border-border flex flex-col p-2 text-xs">
      {/* Computer/Opponent Section */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-primary font-bold">🎮</span>
          <span className="text-foreground font-semibold">{playerLabel}</span>
        </div>

        {/* Deck indicator */}
        <div className="flex gap-0.5 mb-2">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="w-2 h-3 bg-muted rounded-sm" />
          ))}
        </div>

        {/* Color counts */}
        <div className="bg-secondary/50 rounded p-1.5 mb-2">
          <div className="text-muted-foreground text-[10px] mb-1">Color</div>
          <div className="flex items-center justify-between">
            {mainColors.map((color) => (
              <div key={color} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${colorDotClasses[color]}`} />
                <span className="text-foreground font-bold">
                  {playerColorCounts[color] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Points */}
        <div className="bg-secondary/50 rounded p-1.5">
          <div className="text-muted-foreground text-[10px] mb-1">Points</div>
          <div className="text-foreground font-bold text-lg text-center">
            {playerPoints}
          </div>
          <div className="text-muted-foreground text-[10px] text-center">
            -10 for Swapping
          </div>
        </div>
      </div>

      {/* VS Divider */}
      <div className="border-t border-border py-2 mb-3 flex items-center justify-center">
        <span className="text-muted-foreground font-bold">VS</span>
      </div>

      {/* Player Section */}
      {opponentLabel && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-accent font-bold">👤</span>
            <span className="text-foreground font-semibold">{opponentLabel}</span>
          </div>

          {/* Color counts */}
          <div className="bg-secondary/50 rounded p-1.5 mb-2">
            <div className="text-muted-foreground text-[10px] mb-1">Color</div>
            <div className="flex items-center justify-between">
              {mainColors.map((color) => (
                <div key={color} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${colorDotClasses[color]}`} />
                  <span className="text-foreground font-bold">
                    {opponentColorCounts?.[color] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Points */}
          <div className="bg-secondary/50 rounded p-1.5">
            <div className="text-muted-foreground text-[10px] mb-1">Points</div>
            <div className="text-foreground font-bold text-lg text-center">
              {opponentPoints}
            </div>
            <div className="text-muted-foreground text-[10px] text-center">
              -10 for Swapping
            </div>
          </div>

          {/* Deck indicator */}
          <div className="flex gap-0.5 mt-2">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="w-2 h-3 bg-muted rounded-sm" />
            ))}
          </div>
        </div>
      )}

      {/* Quit button */}
      {onQuit && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-auto text-destructive hover:text-destructive"
          onClick={onQuit}
        >
          Quit
        </Button>
      )}
    </div>
  );
};
