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

interface CardHandProps {
  cards: GameCard[];
  selectedCard: GameCard | null;
  onSelectCard: (card: GameCard) => void;
}

export const CardHand = ({ cards, selectedCard, onSelectCard }: CardHandProps) => {
  return (
    <div className="flex-1 p-2 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => {
          const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";
          const imageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
          const isSelected = selectedCard?.id === card.id;

          return (
            <div
              key={card.id}
              className={`relative cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-accent scale-105" : "hover:scale-105"
              }`}
              onClick={() => onSelectCard(card)}
            >
              <div className={`w-16 h-16 mx-auto rounded-full ${bgColor} overflow-hidden border-2 ${isSelected ? "border-accent" : "border-muted"} shadow-lg`}>
                <img
                  src={imageUrl}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${bgColor} w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-card`}>
                {card.basePoints}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
