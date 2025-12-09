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
  size?: "small" | "normal";
}

export const BoardSlot = ({
  slot,
  isActive,
  isClickable,
  onClick,
  size = "normal",
}: BoardSlotProps) => {
  const sizeClasses = size === "small" ? "w-14 h-14" : "w-16 h-16";
  const pointsSize = size === "small" ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-xs";

  if (slot) {
    const bgColor = colorBg[slot.card.colors?.[0]] || "bg-gray-500";
    const imageUrl = `${IMAGE_BASE_URL}/${slot.card.id}.jpg`;

    return (
      <div className={`${sizeClasses} relative ${slot.cancelled ? "opacity-40" : ""}`}>
        <div className={`w-full h-full rounded-full ${bgColor} overflow-hidden border-2 border-muted shadow-lg`}>
          <img
            src={imageUrl}
            alt={slot.card.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className={`absolute -bottom-1 -right-1 ${pointsSize} ${bgColor} rounded-full flex items-center justify-center font-bold text-white border-2 border-card shadow-md`}>
          {slot.modifiedPoints}
        </div>
        {slot.cancelled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-destructive text-2xl font-bold">✕</span>
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
      } ${isClickable ? "cursor-pointer hover:bg-primary/20 hover:border-primary/80" : ""}`}
      onClick={isClickable ? onClick : undefined}
    />
  );
};
