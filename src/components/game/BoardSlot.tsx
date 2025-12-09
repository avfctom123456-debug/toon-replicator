import { PlacedCard } from "@/lib/gameEngine";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal/released";

const colorBg: Record<string, string> = {
  SILVER: "bg-gray-400",
  BLUE: "bg-blue-500",
  BLACK: "bg-gray-800",
  GREEN: "bg-green-500",
  PURPLE: "bg-purple-500",
  RED: "bg-red-500",
  ORANGE: "bg-orange-500",
  YELLOW: "bg-yellow-500",
  PINK: "bg-pink-500",
  WHITE: "bg-white",
};

interface BoardSlotProps {
  slot: PlacedCard | null;
  isActive: boolean;
  isClickable: boolean;
  onClick?: () => void;
  isHidden?: boolean;
  isRevealing?: boolean;
  hasEffect?: boolean;
}

export const BoardSlot = ({
  slot,
  isActive,
  isClickable,
  onClick,
  isHidden = false,
  isRevealing = false,
  hasEffect = false,
}: BoardSlotProps) => {
  const sizeClasses = "w-12 h-12 sm:w-16 sm:h-16";
  const pointsSize = "w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs";

  if (slot) {
    const bgColor = colorBg[slot.card.colors?.[0]] || "bg-gray-500";
    const imageUrl = `${IMAGE_BASE_URL}/${slot.card.id}.jpg`;

    // Hidden card (face down)
    if (isHidden) {
      return (
        <div className={`${sizeClasses} relative`}>
          <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/40 to-primary/20 border-2 border-primary/30 shadow-lg flex items-center justify-center">
            <span className="text-primary/50 text-lg sm:text-2xl">?</span>
          </div>
        </div>
      );
    }

    return (
      <div 
        className={`${sizeClasses} relative ${slot.cancelled ? "opacity-40" : ""} ${
          isRevealing ? "animate-flip-in" : ""
        } ${hasEffect ? "animate-pulse-glow" : ""}`}
      >
        <div className={`w-full h-full rounded-full ${bgColor} overflow-hidden border-2 border-muted shadow-lg transition-transform ${
          hasEffect ? "scale-110" : ""
        }`}>
          <img
            src={imageUrl}
            alt={slot.card.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className={`absolute -bottom-1 -right-1 ${pointsSize} ${bgColor} rounded-full flex items-center justify-center font-bold text-white border-2 border-card shadow-md transition-all ${
          hasEffect ? "scale-125 ring-2 ring-accent" : ""
        }`}>
          {slot.modifiedPoints}
        </div>
        {slot.cancelled && (
          <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
            <span className="text-destructive text-xl sm:text-2xl font-bold drop-shadow-lg">✕</span>
          </div>
        )}
        {/* Points change indicator */}
        {hasEffect && slot.modifiedPoints !== slot.card.basePoints && (
          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold px-1 rounded animate-bounce ${
            slot.modifiedPoints > slot.card.basePoints ? "text-green-400" : "text-red-400"
          }`}>
            {slot.modifiedPoints > slot.card.basePoints ? `+${slot.modifiedPoints - slot.card.basePoints}` : slot.modifiedPoints - slot.card.basePoints}
          </div>
        )}
      </div>
    );
  }

  // Empty slot
  return (
    <div
      className={`${sizeClasses} rounded-full border-2 border-dashed transition-all ${
        isActive
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/30 bg-muted/20"
      } ${isClickable ? "cursor-pointer hover:bg-primary/20 hover:border-primary/80 hover:scale-105" : ""}`}
      onClick={isClickable ? onClick : undefined}
    />
  );
};
