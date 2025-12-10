import { useState } from "react";
import { PlacedCard } from "@/lib/gameEngine";
import gtoonsLogo from "@/assets/gtoons-logo.svg";
import { CardEffectBadge } from "./EffectIndicators";

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

interface ClassicBoardSlotProps {
  slot: PlacedCard | null;
  isActive?: boolean;
  isClickable?: boolean;
  onClick?: () => void;
  onViewCard?: () => void;
  isHidden?: boolean;
  isRevealing?: boolean;
  hasEffect?: boolean;
  customImageUrl?: string | null;
}

export const ClassicBoardSlot = ({
  slot,
  isActive = false,
  isClickable = false,
  onClick,
  onViewCard,
  isHidden = false,
  isRevealing = false,
  hasEffect = false,
  customImageUrl,
}: ClassicBoardSlotProps) => {
  const [imageError, setImageError] = useState(false);
  const slotSize = "w-20 h-20";

  if (slot) {
    const bgColor = colorBg[slot.card.colors?.[0]] || "bg-gray-500";
    const borderColor = colorBorder[slot.card.colors?.[0]] || "border-gray-400";
    const defaultImageUrl = `${IMAGE_BASE_URL}/${slot.card.id}.jpg`;
    const imageUrl = customImageUrl || defaultImageUrl;
    // Hidden card (face down with GToons logo)
    if (isHidden) {
      return (
        <div className={`${slotSize} relative`}>
          <div className="w-full h-full rounded-full bg-gradient-to-br from-[hsl(200,30%,85%)] to-[hsl(200,35%,70%)] border-4 border-[hsl(200,25%,65%)] shadow-lg flex items-center justify-center overflow-hidden">
            <img 
              src={gtoonsLogo} 
              alt="Hidden" 
              className="w-12 h-12 opacity-40"
            />
          </div>
        </div>
      );
    }

    const pointsDiff = slot.modifiedPoints - slot.card.basePoints;
    const hasPointsChange = pointsDiff !== 0;

    return (
      <div 
        className={`${slotSize} relative ${slot.cancelled ? "opacity-40" : ""} ${
          isRevealing ? "animate-scale-in" : ""
        } ${(onViewCard || isClickable) ? "cursor-pointer" : ""}`}
        onClick={isClickable ? onClick : onViewCard}
      >
        <div className={`w-full h-full rounded-full ${bgColor} overflow-hidden border-4 ${borderColor} shadow-lg transition-transform ${
          hasEffect ? "scale-110 ring-2 ring-yellow-400" : ""
        } ${onViewCard ? "hover:ring-2 hover:ring-white/50" : ""} ${isClickable ? "hover:ring-2 hover:ring-red-400/50 hover:scale-95" : ""}`}>
          {!imageError ? (
            <img
              src={imageUrl}
              alt={slot.card.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">{slot.card.title[0]}</span>
            </div>
          )}
        </div>
        {/* Points Badge */}
        <div className={`absolute -bottom-1 -right-1 w-7 h-7 ${bgColor} rounded-full flex items-center justify-center font-bold text-white text-sm border-2 border-white shadow-md transition-all ${
          hasEffect ? "scale-125" : ""
        }`}>
          {slot.modifiedPoints}
        </div>
        {/* Cancelled X */}
        {slot.cancelled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-600 text-4xl font-bold drop-shadow-lg">✕</span>
          </div>
        )}
        {/* Points change indicator - always show on cards with effects */}
        {hasPointsChange && (
          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-sm font-bold px-2 py-0.5 rounded-full shadow-lg ${
            pointsDiff > 0 
              ? "text-white bg-green-500 animate-bounce" 
              : "text-white bg-red-500 animate-bounce"
          }`}>
            {pointsDiff > 0 ? `+${pointsDiff}` : pointsDiff}
          </div>
        )}
        {/* Special effect badges */}
        <CardEffectBadge slot={slot} />
      </div>
    );
  }

  // Empty slot
  return (
    <div
      className={`${slotSize} rounded-full border-4 transition-all ${
        isActive
          ? "border-[hsl(200,40%,55%)] bg-[hsl(200,30%,82%)]"
          : "border-[hsl(200,25%,70%)] bg-[hsl(200,28%,80%)]"
      } ${isClickable ? "cursor-pointer hover:bg-[hsl(200,35%,85%)] hover:border-[hsl(200,50%,50%)] hover:scale-105" : ""} shadow-inner`}
      onClick={isClickable ? onClick : undefined}
    />
  );
};
