import { useState } from "react";

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

interface CardData {
  id: number;
  title: string;
  colors?: string[];
  basePoints?: number;
}

interface MiniCardProps {
  card: CardData;
  size?: "xs" | "sm" | "md";
  showPoints?: boolean;
}

export const MiniCard = ({ card, size = "sm", showPoints = true }: MiniCardProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const bgColor = colorBg[card.colors?.[0] || ""] || "bg-gray-500";

  const sizeClasses = {
    xs: "w-8 h-8",
    sm: "w-12 h-12",
    md: "w-16 h-16",
  };

  const pointsSizeClasses = {
    xs: "w-4 h-4 text-[8px] -bottom-0.5 -right-0.5",
    sm: "w-5 h-5 text-[10px] -bottom-0.5 -right-0.5",
    md: "w-6 h-6 text-xs -bottom-1 -right-1",
  };

  return (
    <div className="relative inline-block">
      <div className={`${sizeClasses[size]} rounded-full ${bgColor} overflow-hidden border-2 border-muted shadow-md`}>
        {!imageError ? (
          <img
            src={imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">{card.title[0]}</span>
          </div>
        )}
      </div>
      {showPoints && card.basePoints !== undefined && (
        <div className={`absolute ${pointsSizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center font-bold text-white border border-card shadow-sm`}>
          {card.basePoints}
        </div>
      )}
    </div>
  );
};

interface CardRowProps {
  card: CardData;
  onRemove?: () => void;
}

export const CardChip = ({ card, onRemove }: CardRowProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const bgColor = colorBg[card.colors?.[0] || ""] || "bg-gray-500";

  return (
    <div className="flex items-center gap-2 bg-muted/50 rounded-full pl-1 pr-2 py-1">
      <div className={`w-6 h-6 rounded-full ${bgColor} overflow-hidden border border-muted`}>
        {!imageError ? (
          <img
            src={imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-white text-[10px] font-bold flex items-center justify-center w-full h-full">
            {card.title[0]}
          </span>
        )}
      </div>
      <span className="text-xs text-foreground font-medium">{card.title}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
};
