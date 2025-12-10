import { X } from "lucide-react";
import { PlacedCard } from "@/lib/gameEngine";
import { useCardOverrides } from "@/hooks/useCardOverrides";

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

interface CardInfoModalProps {
  placedCard: PlacedCard | null;
  onClose: () => void;
}

export const CardInfoModal = ({ placedCard, onClose }: CardInfoModalProps) => {
  const { getOverride } = useCardOverrides();
  
  if (!placedCard) return null;

  const { card, modifiedPoints, cancelled } = placedCard;
  const override = getOverride(card.id);
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";
  const imageUrl = override?.custom_image_url || `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const pointsDiff = modifiedPoints - card.basePoints;

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-card rounded-xl p-4 max-w-xs w-full shadow-2xl border border-border animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Card Image */}
        <div className="flex justify-center mb-3">
          <div className={`w-24 h-24 rounded-full ${bgColor} overflow-hidden border-4 border-muted shadow-lg ${cancelled ? "opacity-50" : ""}`}>
            <img
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Type icons */}
        <div className="flex justify-center gap-2 mb-2">
          {card.types?.includes("MALE") && <span className="text-lg">♂</span>}
          {card.types?.includes("FEMALE") && <span className="text-lg">♀</span>}
          {card.types?.includes("HERO") && <span className="text-lg">🦸</span>}
          {card.types?.includes("VILLAIN") && <span className="text-lg">😈</span>}
        </div>

        {/* Card Info */}
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold text-foreground">{card.title}</h2>
          {card.character !== card.title && (
            <p className="text-sm text-muted-foreground">{card.character}</p>
          )}
        </div>

        {/* Points */}
        <div className="flex justify-center items-center gap-2 mb-3">
          <div className={`${bgColor} px-4 py-1 rounded-full`}>
            <span className="text-white font-bold">{modifiedPoints} Points</span>
          </div>
          {pointsDiff !== 0 && (
            <span className={`text-sm font-bold ${pointsDiff > 0 ? "text-green-400" : "text-red-400"}`}>
              ({pointsDiff > 0 ? `+${pointsDiff}` : pointsDiff} from base)
            </span>
          )}
        </div>

        {/* Cancelled indicator */}
        {cancelled && (
          <div className="text-center text-destructive font-bold mb-2">
            ✕ CANCELLED
          </div>
        )}

        {/* Description */}
        <p className="text-foreground text-center text-sm mb-3">{card.description}</p>

        {/* Colors & Types */}
        <div className="flex flex-wrap justify-center gap-1">
          {card.colors?.map((color) => (
            <span key={color} className={`${colorBg[color] || "bg-gray-500"} text-white text-xs px-2 py-0.5 rounded`}>
              {color}
            </span>
          ))}
          {card.groups?.map((group) => (
            <span key={group} className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded">
              {group}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
