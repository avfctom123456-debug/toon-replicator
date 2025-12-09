import { useState, useEffect } from "react";
import { Dices } from "lucide-react";
import cardsData from "@/data/cards.json";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal/released";

interface DeckSlot {
  slot: string;
  name: string;
  cardIds: number[];
  filled: number;
}

interface ClassicDeckSelectProps {
  decks: DeckSlot[];
  timeLeft: number;
  onSelectDeck: (cardIds: number[]) => void;
  message?: string;
}

const getCardById = (id: number) => {
  return (cardsData as { id: number; title: string; colors: string[]; basePoints: number }[]).find(
    (card) => card.id === id
  );
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

export const ClassicDeckSelect = ({
  decks,
  timeLeft,
  onSelectDeck,
  message,
}: ClassicDeckSelectProps) => {
  const [selectedDeckIndex, setSelectedDeckIndex] = useState<number | null>(null);
  const [hoveredDeck, setHoveredDeck] = useState<number | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (window.innerWidth < 1024) {
        setScale(window.innerWidth / 1024);
      } else {
        setScale(1);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const displayedDeck = hoveredDeck ?? selectedDeckIndex;
  const deckCards =
    displayedDeck !== null ? decks[displayedDeck]?.cardIds.map(getCardById).filter(Boolean) : [];

  const handleRandomDeck = () => {
    const validDecks = decks.filter((d) => d.filled >= 12);
    if (validDecks.length > 0) {
      const randomIndex = Math.floor(Math.random() * validDecks.length);
      const selectedDeck = validDecks[randomIndex];
      onSelectDeck(selectedDeck.cardIds);
    }
  };

  const handleDeckClick = (index: number) => {
    const deck = decks[index];
    if (deck.filled >= 12) {
      setSelectedDeckIndex(index);
      onSelectDeck(deck.cardIds);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[hsl(212,69%,16%)] overflow-hidden"
      style={{ height: scale < 1 ? `${100 / scale}vh` : 'auto' }}
    >
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{ 
          width: "1024px",
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
      {/* Header Pill */}
      <div className="mb-8">
        <div className="bg-gradient-to-b from-[hsl(200,30%,85%)] to-[hsl(200,30%,75%)] rounded-full px-8 py-3 shadow-lg border-2 border-[hsl(200,40%,90%)]">
          <span className="text-[hsl(212,69%,25%)] font-bold text-lg tracking-wide">
            Choose Your Deck
          </span>
          <span className="text-[hsl(212,50%,40%)] font-medium ml-4">
            Time Left: {timeLeft}
          </span>
        </div>
      </div>

      {message && (
        <p className="text-red-400 mb-4 text-center">{message}</p>
      )}

      <div className="flex gap-6 items-start max-w-4xl w-full justify-center">
        {/* Left Panel - Deck List */}
        <div className="bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,65%)] rounded-xl p-1 shadow-xl">
          <div className="bg-gradient-to-b from-[hsl(200,25%,80%)] to-[hsl(200,30%,70%)] rounded-lg overflow-hidden">
            {/* Deck Slots */}
            {decks.map((deck, index) => (
              <div
                key={deck.slot}
                onClick={() => handleDeckClick(index)}
                onMouseEnter={() => setHoveredDeck(index)}
                onMouseLeave={() => setHoveredDeck(null)}
                className={`
                  flex items-center justify-between px-4 py-3 cursor-pointer transition-all
                  border-b border-[hsl(200,30%,60%)]/30
                  ${deck.filled >= 12 
                    ? "hover:bg-[hsl(200,40%,85%)]" 
                    : "opacity-50 cursor-not-allowed"
                  }
                  ${selectedDeckIndex === index ? "bg-[hsl(200,40%,85%)]" : ""}
                `}
              >
                <span className="text-[hsl(212,50%,30%)] font-semibold italic text-lg">
                  {deck.slot}
                </span>
                <span className="text-[hsl(212,50%,35%)] font-medium">
                  {deck.filled}
                </span>
              </div>
            ))}

            {/* Random Deck Option */}
            <div
              onClick={handleRandomDeck}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[hsl(200,40%,85%)] transition-all border-b border-[hsl(200,30%,60%)]/30"
            >
              <Dices className="w-5 h-5 text-[hsl(212,50%,35%)]" />
              <span className="text-[hsl(212,50%,30%)] font-bold">Random Deck</span>
            </div>

            {/* Selected Deck Info */}
            {selectedDeckIndex !== null && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(200,25%,88%)]">
                <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {decks[selectedDeckIndex].slot}
                  </span>
                </div>
                <span className="text-[hsl(212,50%,35%)] font-medium italic">
                  {decks[selectedDeckIndex].name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Card List (3D tilted) */}
        <div 
          className="bg-gradient-to-b from-[hsl(200,30%,75%)] to-[hsl(200,35%,65%)] rounded-xl p-1 shadow-xl"
          style={{
            transform: "perspective(800px) rotateY(-8deg) rotateX(2deg)",
            transformOrigin: "left center",
          }}
        >
          <div className="bg-gradient-to-b from-[hsl(200,40%,80%)] to-[hsl(200,35%,70%)] rounded-lg overflow-hidden w-64">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[hsl(200,50%,70%)] border-b border-[hsl(200,40%,60%)]">
              <span className="text-[hsl(212,60%,25%)] font-bold text-sm">Name</span>
              <div className="flex gap-4">
                <span className="text-[hsl(212,60%,25%)] font-bold text-sm">Clr</span>
                <span className="text-[hsl(212,60%,25%)] font-bold text-sm">Pts</span>
              </div>
            </div>

            {/* Card Rows */}
            <div className="max-h-80 overflow-y-auto">
              {deckCards.length > 0 ? (
                deckCards.map((card, index) => (
                  <div
                    key={card?.id || index}
                    className="flex items-center justify-between px-4 py-2 border-b border-[hsl(200,30%,60%)]/30 hover:bg-[hsl(200,40%,85%)] transition-all"
                  >
                    <span className="text-[hsl(212,50%,30%)] text-sm truncate flex-1 mr-2">
                      {card?.title}
                    </span>
                    <div className="flex gap-4 items-center">
                      <div
                        className={`w-4 h-4 rounded-full ${colorBg[card?.colors?.[0] || ""] || "bg-gray-400"}`}
                      />
                      <span className="text-[hsl(212,50%,30%)] text-sm font-medium w-6 text-right">
                        {card?.basePoints}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                // Empty rows for placeholder
                Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-4 py-2 border-b border-[hsl(200,30%,60%)]/30"
                  >
                    <span className="text-transparent">-</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
