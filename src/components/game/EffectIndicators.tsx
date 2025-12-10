import { GameState, PlacedCard } from "@/lib/gameEngine";
import { Sparkles, ArrowDownUp, Palette, Shuffle, Zap, Shield, Target } from "lucide-react";

interface EffectIndicatorsProps {
  game: GameState;
  isRevealing: boolean;
}

interface ActiveEffect {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}

export const EffectIndicators = ({ game, isRevealing }: EffectIndicatorsProps) => {
  const activeEffects: ActiveEffect[] = [];
  
  // Check all cards for active effects
  const allCards = [...game.player.board, ...game.opponent.board].filter(
    (slot): slot is PlacedCard => slot !== null && !slot.cancelled
  );
  
  // Check for reverse scoring
  const hasReverseScoring = allCards.some(
    slot => (slot as any).triggersReverseScoring
  );
  if (hasReverseScoring) {
    activeEffects.push({
      id: "reverse",
      icon: <ArrowDownUp className="w-4 h-4" />,
      label: "Reverse Scoring",
      color: "bg-purple-500",
    });
  }
  
  // Check for color condition changes
  const colorChangeCard = allCards.find(
    slot => (slot as any).changesColorConditionTo
  );
  if (colorChangeCard) {
    const newColor = (colorChangeCard as any).changesColorConditionTo;
    activeEffects.push({
      id: "color-change",
      icon: <Palette className="w-4 h-4" />,
      label: `Color: ${newColor}`,
      color: getColorClass(newColor),
    });
  }
  
  // Check for "counts as all colors" cards
  const wildCards = allCards.filter(slot => slot.countsAsAllColors);
  if (wildCards.length > 0) {
    activeEffects.push({
      id: "wild",
      icon: <Sparkles className="w-4 h-4" />,
      label: "Wild Card",
      color: "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500",
    });
  }
  
  // Check for converted colors
  const convertedCards = allCards.filter(slot => slot.convertedColors);
  if (convertedCards.length > 0) {
    activeEffects.push({
      id: "convert",
      icon: <Shuffle className="w-4 h-4" />,
      label: "Colors Converted",
      color: "bg-orange-500",
    });
  }
  
  // Check for swapped positions
  const swappedCards = allCards.filter(slot => slot.swappedPosition !== undefined);
  if (swappedCards.length > 0) {
    activeEffects.push({
      id: "swap",
      icon: <ArrowDownUp className="w-4 h-4" />,
      label: "Position Swapped",
      color: "bg-cyan-500",
    });
  }
  
  // Check for shielded cards
  const shieldedCards = allCards.filter(slot => slot.shielded);
  if (shieldedCards.length > 0) {
    activeEffects.push({
      id: "shield",
      icon: <Shield className="w-4 h-4" />,
      label: "Shielded",
      color: "bg-blue-400",
    });
  }
  
  if (activeEffects.length === 0 || !isRevealing) return null;
  
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-wrap gap-2 justify-center max-w-md">
      {activeEffects.map((effect, index) => (
        <div
          key={effect.id}
          className={`${effect.color} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-scale-in`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {effect.icon}
          <span>{effect.label}</span>
        </div>
      ))}
    </div>
  );
};

// Helper component for showing effect on individual cards
export const CardEffectBadge = ({ slot }: { slot: PlacedCard }) => {
  const badges: { icon: React.ReactNode; color: string; title: string }[] = [];
  
  if (slot.countsAsAllColors) {
    badges.push({
      icon: <Sparkles className="w-3 h-3" />,
      color: "bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400",
      title: "Counts as all colors",
    });
  }
  
  if (slot.shielded) {
    badges.push({
      icon: <Shield className="w-3 h-3" />,
      color: "bg-blue-400",
      title: "Shielded",
    });
  }
  
  if ((slot as any).triggersReverseScoring) {
    badges.push({
      icon: <ArrowDownUp className="w-3 h-3" />,
      color: "bg-purple-500",
      title: "Reverse Scoring",
    });
  }
  
  if ((slot as any).changesColorConditionTo) {
    badges.push({
      icon: <Palette className="w-3 h-3" />,
      color: getColorClass((slot as any).changesColorConditionTo),
      title: `Changes color to ${(slot as any).changesColorConditionTo}`,
    });
  }
  
  if (slot.convertedColors) {
    badges.push({
      icon: <Shuffle className="w-3 h-3" />,
      color: "bg-orange-500",
      title: "Color converted",
    });
  }
  
  if (slot.stolenPoints && slot.stolenPoints > 0) {
    badges.push({
      icon: <Target className="w-3 h-3" />,
      color: "bg-red-500",
      title: `${slot.stolenPoints} points stolen`,
    });
  }
  
  if (badges.length === 0) return null;
  
  return (
    <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex flex-col gap-1">
      {badges.map((badge, i) => (
        <div
          key={i}
          className={`${badge.color} p-1 rounded-full shadow-lg animate-pulse`}
          title={badge.title}
        >
          {badge.icon}
        </div>
      ))}
    </div>
  );
};

function getColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    RED: "bg-red-500",
    BLUE: "bg-blue-500",
    GREEN: "bg-green-500",
    YELLOW: "bg-yellow-500",
    PURPLE: "bg-purple-500",
    ORANGE: "bg-orange-500",
    PINK: "bg-pink-500",
    BLACK: "bg-gray-800",
    WHITE: "bg-gray-200 text-gray-800",
    SILVER: "bg-gray-400",
  };
  return colorMap[color.toUpperCase()] || "bg-gray-500";
}
