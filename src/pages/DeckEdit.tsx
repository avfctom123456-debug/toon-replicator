import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import cardsData from "@/data/cards.json";

const IMAGE_BASE_URL = "https://raw.githubusercontent.com/ZakRabe/gtoons/master/client/public/images/normal";

const colorMap: Record<string, string> = {
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

const DeckEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";
  
  const [search, setSearch] = useState("");
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  const filteredCards = useMemo(() => {
    return cardsData.filter((c: any) => 
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.character.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50); // Limit for performance
  }, [search]);

  const toggleCard = (id: number) => {
    if (selectedCards.includes(id)) {
      setSelectedCards(selectedCards.filter(c => c !== id));
    } else if (selectedCards.length < 12) {
      setSelectedCards([...selectedCards, id]);
    }
  };

  const getImageUrl = (id: number) => `${IMAGE_BASE_URL}/${id}.png`;
  const getColor = (colors: string[]) => colorMap[colors?.[0]] || "bg-gray-500";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Search */}
      <div className="p-4">
        <Input
          type="text"
          placeholder="Search characters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Character List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {filteredCards.map((card: any) => (
          <div 
            key={card.id}
            onClick={() => toggleCard(card.id)}
            className={`bg-card rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all ${
              selectedCards.includes(card.id) ? "ring-2 ring-accent" : ""
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 rounded-full ${getColor(card.colors)} flex items-center justify-center overflow-hidden border-2 border-muted`}>
                <img 
                  src={getImageUrl(card.id)} 
                  alt={card.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${getColor(card.colors)} flex items-center justify-center text-xs font-bold text-white border-2 border-card`}>
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
        ))}
      </div>

      {/* Bottom Selection */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-foreground font-bold">{selectedCards.length}/12</span>
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div 
                key={i}
                className={`w-12 h-12 rounded-lg flex-shrink-0 ${
                  i < selectedCards.length ? "bg-accent/50" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <Button 
            variant="link" 
            className="text-foreground underline"
            onClick={() => navigate("/deck-builder", { state: { username } })}
          >
            Save
          </Button>
          <Button 
            variant="link"
            className="text-foreground underline"
            onClick={() => navigate("/deck-builder", { state: { username } })}
          >
            Cancel
          </Button>
        </div>
      </div>

      <div className="fixed bottom-20 left-4 text-muted-foreground text-xs">
        v0.0.36
      </div>
    </div>
  );
};

export default DeckEdit;
