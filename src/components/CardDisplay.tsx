import { useState } from "react";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal/released";

const colorMap: Record<string, string> = {
  SILVER: "from-gray-300 to-gray-500",
  BLUE: "from-blue-400 to-blue-600",
  BLACK: "from-gray-700 to-gray-900",
  GREEN: "from-green-400 to-green-600",
  PURPLE: "from-purple-400 to-purple-600",
  RED: "from-red-400 to-red-600",
  ORANGE: "from-orange-400 to-orange-600",
  YELLOW: "from-yellow-400 to-yellow-600",
  PINK: "from-pink-400 to-pink-600",
  WHITE: "from-gray-100 to-gray-300",
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

interface CardData {
  id: number;
  title: string;
  character: string;
  basePoints: number;
  points: number;
  colors: string[];
  description: string;
  rarity: string;
  groups: string[];
  types: string[];
}

interface CardDisplayProps {
  card: CardData;
  size?: "small" | "medium" | "large";
  selected?: boolean;
  onClick?: () => void;
}

export const CardDisplay = ({ card, size = "medium", selected = false, onClick }: CardDisplayProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const gradient = colorMap[card.colors?.[0]] || "from-gray-400 to-gray-600";
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";
  
  const sizeClasses = {
    small: "w-16 h-16",
    medium: "w-20 h-20",
    large: "w-32 h-32",
  };

  const pointsSizeClasses = {
    small: "w-5 h-5 text-xs -bottom-1 -right-1",
    medium: "w-6 h-6 text-xs -bottom-1 -right-1",
    large: "w-8 h-8 text-sm -bottom-2 -right-2",
  };

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer transition-transform hover:scale-105 ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
    >
      <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} p-0.5 shadow-lg`}>
        <div className={`w-full h-full rounded-full ${bgColor} overflow-hidden flex items-center justify-center`}>
          {!imageError ? (
            <img 
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-white font-bold text-lg">{card.title[0]}</span>
          )}
        </div>
      </div>
      <div className={`absolute ${pointsSizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center font-bold text-white border-2 border-card shadow-md`}>
        {card.basePoints}
      </div>
    </div>
  );
};

interface CardListItemProps {
  card: CardData;
  selected?: boolean;
  onClick?: () => void;
}

export const CardListItem = ({ card, selected = false, onClick }: CardListItemProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";

  return (
    <div 
      onClick={onClick}
      className={`bg-card rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-card/80 ${
        selected ? "ring-2 ring-accent" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-14 h-14 rounded-full ${bgColor} flex items-center justify-center overflow-hidden border-2 border-muted`}>
          {!imageError ? (
            <img 
              src={imageUrl}
              alt={card.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-white font-bold text-xl">{card.title[0]}</span>
          )}
        </div>
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${bgColor} flex items-center justify-center text-xs font-bold text-white border-2 border-card`}>
          {card.basePoints}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-foreground">{card.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{card.description}</p>
      </div>

      {/* Icons */}
      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        {card.types?.includes("MALE") && <span>♂</span>}
        {card.types?.includes("FEMALE") && <span>♀</span>}
        {card.types?.includes("HERO") && <span>🦸</span>}
        {card.types?.includes("VILLAIN") && <span>😈</span>}
        {card.types?.includes("VEHICLE") && <span>🚗</span>}
      </div>
    </div>
  );
};

interface FullCardProps {
  card: CardData;
  onClose?: () => void;
}

export const FullCard = ({ card, onClose }: FullCardProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const gradient = colorMap[card.colors?.[0]] || "from-gray-400 to-gray-600";
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-gradient-to-br ${gradient} p-1 rounded-2xl max-w-sm w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card rounded-xl p-4 flex flex-col items-center gap-4">
          {/* Card Image */}
          <div className={`w-40 h-40 rounded-full ${bgColor} overflow-hidden border-4 border-muted shadow-lg`}>
            {!imageError ? (
              <img 
                src={imageUrl}
                alt={card.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white font-bold text-4xl">{card.title[0]}</span>
              </div>
            )}
          </div>

          {/* Card Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{card.title}</h2>
            {card.character !== card.title && (
              <p className="text-muted-foreground text-sm">{card.character}</p>
            )}
          </div>

          {/* Points */}
          <div className={`${bgColor} px-6 py-2 rounded-full`}>
            <span className="text-white font-bold text-xl">{card.basePoints} Points</span>
          </div>

          {/* Description */}
          <p className="text-foreground text-center">{card.description}</p>

          {/* Details */}
          <div className="flex flex-wrap justify-center gap-2">
            {card.colors?.map((color) => (
              <span key={color} className={`${colorBg[color] || "bg-gray-500"} text-white text-xs px-2 py-1 rounded`}>
                {color}
              </span>
            ))}
            {card.types?.map((type) => (
              <span key={type} className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                {type}
              </span>
            ))}
            <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded">
              {card.rarity}
            </span>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
