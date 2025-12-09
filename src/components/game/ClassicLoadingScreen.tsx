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

interface ClassicCardDisplayProps {
  card: GameCard;
  playerName: string;
  isOpponent?: boolean;
}

const ClassicCardDisplay = ({ card, playerName, isOpponent }: ClassicCardDisplayProps) => {
  const [imageError, setImageError] = useState(false);
  const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const borderColor = colorBorder[card.colors?.[0]] || "border-gray-400";
  const bgColor = colorBg[card.colors?.[0]] || "bg-gray-400";

  return (
    <div className="flex flex-col items-center">
      {/* Main Card */}
      <div className="bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,60%)] rounded-2xl p-1 shadow-2xl">
        <div className="bg-gradient-to-b from-[hsl(200,40%,80%)] to-[hsl(200,35%,70%)] rounded-xl p-4 w-52">
          {/* Card Image Circle */}
          <div className="flex justify-center mb-3">
            <div className={`relative w-32 h-32 rounded-full border-4 ${borderColor} overflow-hidden shadow-lg`}>
              {!imageError ? (
                <img
                  src={imageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className={`w-full h-full ${bgColor} flex items-center justify-center`}>
                  <span className="text-white font-bold text-3xl">{card.title[0]}</span>
                </div>
              )}
              {/* Points Badge */}
              <div className={`absolute bottom-0 right-0 ${bgColor} w-10 h-10 rounded-full border-2 border-white flex items-center justify-center shadow-md`}>
                <span className="text-white font-bold text-lg">{card.basePoints}</span>
              </div>
            </div>
          </div>

          {/* Type Icons */}
          <div className="flex justify-center gap-2 mb-2 text-[hsl(212,50%,35%)]">
            {card.types?.includes("MALE") && <span>♂</span>}
            {card.types?.includes("FEMALE") && <span>♀</span>}
            {card.types?.includes("HERO") && <span>👑</span>}
            {card.types?.includes("VILLAIN") && <span>😈</span>}
          </div>

          {/* Card Title */}
          <h3 className="text-[hsl(212,60%,25%)] font-bold text-center text-lg mb-1">
            {card.title}
          </h3>

          {/* Card Description */}
          <p className="text-[hsl(212,50%,35%)] text-center text-sm mb-4 min-h-[40px]">
            {card.description || "No power"}
          </p>

          {/* Bottom Section */}
          <div className="flex items-center justify-between">
            <span className="text-[hsl(212,50%,30%)] font-bold text-lg">
              {card.rarity?.[0] || "C"}
            </span>
            <div className="flex-1 mx-3">
              {/* Points Bar */}
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 flex-1 rounded-sm ${
                      i < card.basePoints
                        ? "bg-[hsl(200,30%,85%)]"
                        : "bg-[hsl(200,30%,60%)]"
                    }`}
                  />
                ))}
              </div>
            </div>
            <span className="text-[hsl(212,50%,30%)] font-bold text-lg">
              {card.basePoints}
            </span>
          </div>
        </div>
      </div>

      {/* Player Info */}
      <div className="mt-3 flex items-center gap-2 bg-gradient-to-b from-[hsl(200,25%,80%)] to-[hsl(200,30%,70%)] rounded-lg px-4 py-2 shadow-md">
        <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {isOpponent ? "C" : playerName[0]?.toUpperCase()}
          </span>
        </div>
        <span className="text-[hsl(212,50%,35%)] font-medium italic">
          {isOpponent ? "Computer" : playerName}
        </span>
      </div>
    </div>
  );
};

interface ClassicLoadingScreenProps {
  playerCard: GameCard;
  opponentCard: GameCard;
  playerName: string;
  mainColors: string[];
  status: string;
}

export const ClassicLoadingScreen = ({
  playerCard,
  opponentCard,
  playerName,
  mainColors,
  status,
}: ClassicLoadingScreenProps) => {
  const color1 = mainColors[0] || "BLUE";
  const color2 = mainColors[1] || "RED";

  return (
    <div className="min-h-screen bg-[hsl(212,69%,16%)] flex flex-col items-center justify-center p-4" style={{ minWidth: "1024px" }}>
      <div className="flex items-center justify-center gap-8 flex-wrap">
        {/* Player Card */}
        <ClassicCardDisplay card={playerCard} playerName={playerName} />

        {/* Center Info Box */}
        <div className="bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,60%)] rounded-xl p-1 shadow-xl">
          <div className="bg-gradient-to-b from-[hsl(200,40%,80%)] to-[hsl(200,35%,70%)] rounded-lg p-6 w-64">
            <h2 className="text-[hsl(200,70%,50%)] font-bold text-center text-lg mb-4">
              TWO COLORS REVEALED
            </h2>
            <p className="text-[hsl(212,50%,30%)] text-center text-sm mb-3">
              IF A PLAYER HAS MORE CARDS OF BOTH COLORS, HE OR SHE WINS AUTOMATICALLY.
            </p>
            <p className="text-[hsl(212,50%,30%)] text-center text-sm">
              IF NEITHER PLAYER HAS MORE OF BOTH COLORS, THE GAME WILL BE DECIDED BY POINTS.
            </p>

            {/* Color Indicators */}
            <div className="flex justify-center gap-4 mt-4">
              <div className={`w-8 h-8 rounded-full ${colorBg[color1]} border-2 border-white shadow-md`} />
              <div className={`w-8 h-8 rounded-full ${colorBg[color2]} border-2 border-white shadow-md`} />
            </div>
          </div>
        </div>

        {/* Opponent Card */}
        <ClassicCardDisplay card={opponentCard} playerName="Computer" isOpponent />
      </div>

      {/* Status Button */}
      <div className="mt-8">
        <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,30%,75%)] rounded-full px-8 py-3 shadow-lg border-2 border-[hsl(200,40%,90%)]">
          <span className="text-[hsl(212,69%,25%)] font-bold text-lg tracking-wide">
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};
