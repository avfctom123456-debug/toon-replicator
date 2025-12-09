import { Button } from "@/components/ui/button";

interface ClassicPlayerSidebarProps {
  computerName: string;
  computerPoints: number;
  computerColorCounts: Record<string, number>;
  playerName: string;
  playerPoints: number;
  playerColorCounts: Record<string, number>;
  mainColors: string[];
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

const colorNames: Record<string, string> = {
  RED: "Red",
  BLUE: "Blue",
  GREEN: "Grn",
  YELLOW: "Yel",
  ORANGE: "Org",
  PURPLE: "Pur",
  PINK: "Pnk",
  BLACK: "Blk",
  SILVER: "Slv",
};

interface PlayerSectionProps {
  name: string;
  points: number;
  colorCounts: Record<string, number>;
  mainColors: string[];
  deckCount: number;
  isComputer?: boolean;
}

const PlayerSection = ({ name, points, colorCounts, mainColors, deckCount, isComputer }: PlayerSectionProps) => (
  <div className="px-2 py-2">
    {/* Player Header */}
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded flex items-center justify-center ${isComputer ? "bg-orange-600" : "bg-orange-500"}`}>
        {isComputer ? (
          <span className="text-white text-xs font-bold">🎮</span>
        ) : (
          <span className="text-white text-xs font-bold">👑</span>
        )}
      </div>
      <span className="text-[hsl(200,30%,70%)] text-sm italic">{name}</span>
    </div>

    {/* Deck Slot Indicator */}
    <div className="flex items-center gap-1 mb-2">
      <span className="text-[hsl(200,30%,70%)] text-xs font-bold">{isComputer ? "A" : "R"}</span>
      <div className="flex gap-0.5 flex-1">
        {Array(deckCount).fill(0).map((_, i) => (
          <div key={i} className="h-3 flex-1 bg-[hsl(200,30%,85%)] rounded-sm" />
        ))}
      </div>
      <span className="text-[hsl(200,30%,70%)] text-xs font-bold">{deckCount}</span>
    </div>

    {/* Color Section */}
    <div className="bg-[hsl(200,60%,45%)] rounded p-2 mb-2">
      <div className="text-[hsl(200,30%,80%)] text-[10px] mb-1">Color</div>
      <div className="flex items-center justify-around">
        {mainColors.slice(0, 2).map((color) => (
          <div key={color} className="flex items-center gap-1">
            <span className="text-[hsl(200,30%,80%)] text-[10px]">{colorNames[color] || color}</span>
            <div className={`w-3 h-3 rounded-full ${colorDotClasses[color]}`} />
            <span className="text-white font-bold text-lg">
              {colorCounts[color] || 0}
            </span>
          </div>
        ))}
      </div>
    </div>

    {/* Points Section */}
    <div className="bg-[hsl(200,60%,45%)] rounded p-2">
      <div className="text-[hsl(200,30%,80%)] text-[10px] mb-1">Points</div>
      <div className="text-white font-bold text-3xl text-center">
        {points}
      </div>
      <div className="text-[hsl(200,30%,80%)] text-[10px] text-center">
        -10 for Swapping
      </div>
    </div>
  </div>
);

export const ClassicPlayerSidebar = ({
  computerName,
  computerPoints,
  computerColorCounts,
  playerName,
  playerPoints,
  playerColorCounts,
  mainColors,
  onQuit,
}: ClassicPlayerSidebarProps) => {
  return (
    <div className="w-44 bg-[hsl(200,60%,40%)] flex flex-col border-r border-[hsl(200,50%,35%)]">
      {/* Computer Section */}
      <PlayerSection
        name={computerName}
        points={computerPoints}
        colorCounts={computerColorCounts}
        mainColors={mainColors}
        deckCount={6}
        isComputer
      />

      {/* VS Divider */}
      <div className="border-t border-b border-[hsl(200,50%,35%)] py-1 flex items-center justify-center bg-[hsl(200,55%,38%)]">
        <span className="text-[hsl(200,30%,80%)] font-bold text-sm">VS</span>
      </div>

      {/* Player Section */}
      <PlayerSection
        name={playerName}
        points={playerPoints}
        colorCounts={playerColorCounts}
        mainColors={mainColors}
        deckCount={6}
      />

      {/* Quit button at bottom */}
      {onQuit && (
        <div className="mt-auto p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[hsl(200,30%,80%)] hover:text-white hover:bg-[hsl(200,50%,35%)]"
            onClick={onQuit}
          >
            Quit
          </Button>
        </div>
      )}
    </div>
  );
};
