import { GameCard } from "@/lib/gameEngine";

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

interface SelectedCardPreviewProps {
  card: GameCard | null;
}

export const SelectedCardPreview = ({ card }: SelectedCardPreviewProps) => {
  if (!card) {
    return (
      <div className="p-3 border-b border-border">
        <div className="text-xs text-muted-foreground text-center">
          Select a card from your hand
        </div>
      </div>
    );
  }

  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;

  return (
    <div className="p-3 border-b border-border">
      {/* Card Image */}
      <div className="relative mx-auto w-20 h-20 mb-2">
        <div className={`w-full h-full rounded-full ${bgColor} overflow-hidden border-2 border-muted shadow-lg`}>
          <img
            src={imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className={`absolute -bottom-1 -right-1 ${bgColor} w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-card shadow-md`}>
          {card.basePoints}
        </div>
      </div>

      {/* Card Info */}
      <div className="text-center">
        {/* Type icons */}
        <div className="flex justify-center gap-1 mb-1">
          {card.types?.includes("MALE") && <span className="text-sm">♂</span>}
          {card.types?.includes("FEMALE") && <span className="text-sm">♀</span>}
        </div>
        
        <h3 className="text-xs font-bold text-foreground leading-tight">{card.title}</h3>
        
        {/* Description */}
        <p className="text-[10px] text-primary mt-1 leading-tight">
          {card.description}
        </p>
      </div>
    </div>
  );
};
