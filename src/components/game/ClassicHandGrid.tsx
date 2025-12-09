import { useState } from "react";
import { GameCard } from "@/lib/gameEngine";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal/released";

const colorBorder: Record<string, string> = {
  SILVER: "border-gray-400",
  BLUE: "border-blue-500",
  BLACK: "border-gray-800",
  GREEN: "border-green-500",
  PURPLE: "border-purple-500",
  RED: "border-red-500",
  ORANGE: "border-orange-500",
  YELLOW: "border-yellow-500",
  PINK: "border-pink-500",
  WHITE: "border-gray-200",
};

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

interface HandCardProps {
  card: GameCard;
  isSelected: boolean;
  onClick: () => void;
}

const HandCard = ({ card, isSelected, onClick }: HandCardProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const borderColor = colorBorder[card.colors?.[0]] || "border-gray-400";
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-400";

  return (
    <div
      onClick={onClick}
      className={`relative w-14 h-14 cursor-pointer transition-all ${
        isSelected ? "scale-110 ring-2 ring-yellow-400 ring-offset-2 ring-offset-[hsl(200,28%,75%)]" : "hover:scale-105"
      }`}
    >
      <div className={`w-full h-full rounded-full border-3 ${borderColor} overflow-hidden shadow-md`}>
        {!imageError ? (
          <img
            src={imageUrl}
            alt={card.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
            <span className="text-white font-bold text-sm">{card.title[0]}</span>
          </div>
        )}
      </div>
      {/* Points Badge */}
      <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${bgColor} rounded-full flex items-center justify-center font-bold text-white text-[10px] border-2 border-white shadow-sm`}>
        {card.basePoints}
      </div>
    </div>
  );
};

interface ClassicHandGridProps {
  cards: GameCard[];
  selectedCard: GameCard | null;
  onSelectCard: (card: GameCard | null) => void;
}

export const ClassicHandGrid = ({ cards, selectedCard, onSelectCard }: ClassicHandGridProps) => {
  // Create a 2x3 grid with empty slots
  const gridSlots = Array(6).fill(null).map((_, i) => cards[i] || null);

  return (
    <div className="grid grid-cols-2 gap-3">
      {gridSlots.map((card, index) => (
        <div key={index} className="flex justify-center">
          {card ? (
            <HandCard
              card={card}
              isSelected={selectedCard?.id === card.id}
              onClick={() => onSelectCard(selectedCard?.id === card.id ? null : card)}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[hsl(200,25%,70%)] border-2 border-[hsl(200,20%,65%)] shadow-inner" />
          )}
        </div>
      ))}
    </div>
  );
};
