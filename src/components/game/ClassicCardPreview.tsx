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

interface ClassicCardPreviewProps {
  card: GameCard | null;
}

export const ClassicCardPreview = ({ card }: ClassicCardPreviewProps) => {
  const [imageError, setImageError] = useState(false);

  if (!card) {
    return (
      <div className="w-44 bg-gradient-to-b from-[hsl(200,50%,55%)] to-[hsl(200,55%,45%)] rounded-xl p-3 shadow-lg border border-[hsl(200,40%,40%)]">
        <div className="w-28 h-28 mx-auto rounded-full bg-[hsl(200,30%,75%)] border-4 border-[hsl(200,25%,65%)] flex items-center justify-center">
          <span className="text-[hsl(200,30%,50%)] text-sm">Select a card</span>
        </div>
        <div className="text-center mt-3">
          <div className="text-[hsl(200,30%,80%)] text-sm">No card selected</div>
        </div>
      </div>
    );
  }

  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const borderColor = colorBorder[card.colors?.[0]] || "border-gray-400";
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-400";

  return (
    <div className="w-44 bg-gradient-to-b from-[hsl(200,50%,55%)] to-[hsl(200,55%,45%)] rounded-xl p-3 shadow-lg border border-[hsl(200,40%,40%)]">
      {/* Card Image */}
      <div className="flex justify-center mb-2">
        <div className={`relative w-28 h-28 rounded-full border-4 ${borderColor} overflow-hidden shadow-lg`}>
          {!imageError ? (
            <img
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
              <span className="text-white font-bold text-2xl">{card.title[0]}</span>
            </div>
          )}
          {/* Points Badge */}
          <div className={`absolute bottom-0 right-0 ${bgColor} w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-md`}>
            <span className="text-white font-bold text-sm">{card.basePoints}</span>
          </div>
        </div>
      </div>

      {/* Type Icons */}
      <div className="flex justify-center gap-1 mb-1 text-[hsl(200,30%,85%)] text-sm">
        {card.types?.includes("MALE") && <span>♂</span>}
        {card.types?.includes("FEMALE") && <span>♀</span>}
        {card.types?.includes("HERO") && <span>👑</span>}
        {card.types?.includes("VILLAIN") && <span>😈</span>}
        {card.types?.includes("VEHICLE") && <span>🚗</span>}
        {card.types?.includes("ANIMAL") && <span>🐾</span>}
      </div>

      {/* Card Title */}
      <h3 className="text-[hsl(200,80%,85%)] font-bold text-center text-sm mb-1 truncate">
        {card.title}
      </h3>

      {/* Card Description */}
      <p className="text-[hsl(200,30%,80%)] text-center text-xs leading-tight min-h-[32px]">
        {card.description || "No power"}
      </p>
    </div>
  );
};
