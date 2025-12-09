import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const characters = [
  { id: 1, name: "Absolution", power: "+5 if any TOM is in play", points: 2, gender: null, type: "vehicle", color: "blue" },
  { id: 2, name: "Agent Honeydew", power: "No power", points: 8, gender: "female", type: "human", color: "blue" },
  { id: 3, name: "Aku Beast", power: "No power", points: 6, gender: "male", type: "creature", color: "green" },
  { id: 4, name: "Amoeba Boys", power: "-5 to neighboring and opposite Villains", points: 7, gender: "male", type: "creature", color: "purple" },
  { id: 5, name: "Aquaman", power: "+3 to all Green cards", points: 2, gender: "male", type: "human", color: "teal" },
  { id: 6, name: "Bamm-Bamm Baby", power: "No power", points: 6, gender: "male", type: null, color: "orange" },
  { id: 7, name: "Barney Rubble", power: "+10 if next to any Fred Flintstone", points: 3, gender: "male", type: null, color: "brown" },
];

const colorMap: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
  brown: "bg-amber-700",
};

const DeckEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";
  const deckId = location.state?.deckId || "A";
  
  const [search, setSearch] = useState("");
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCard = (id: number) => {
    if (selectedCards.includes(id)) {
      setSelectedCards(selectedCards.filter(c => c !== id));
    } else if (selectedCards.length < 12) {
      setSelectedCards([...selectedCards, id]);
    }
  };

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
        {filteredCharacters.map((char) => (
          <div 
            key={char.id}
            onClick={() => toggleCard(char.id)}
            className={`bg-card rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-all ${
              selectedCards.includes(char.id) ? "ring-2 ring-accent" : ""
            }`}
          >
            {/* Avatar */}
            <div className="relative">
              <div className={`w-14 h-14 rounded-full ${colorMap[char.color] || "bg-gray-500"} flex items-center justify-center overflow-hidden border-2 border-muted`}>
                <span className="text-xl font-bold text-white">{char.name[0]}</span>
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${colorMap[char.color] || "bg-gray-500"} flex items-center justify-center text-xs font-bold text-white border-2 border-card`}>
                {char.points}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground">{char.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{char.power}</p>
            </div>

            {/* Icons */}
            <div className="flex items-center gap-1 text-muted-foreground">
              {char.gender === "male" && <span className="text-lg">♂</span>}
              {char.gender === "female" && <span className="text-lg">♀</span>}
              {char.type === "human" && <span className="text-lg">🏃</span>}
              {char.type === "vehicle" && <span className="text-lg">🚗</span>}
              {char.type === "creature" && <span className="text-lg">😊</span>}
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

        {/* Actions */}
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

      {/* Version */}
      <div className="fixed bottom-20 left-4 text-muted-foreground text-xs">
        v0.0.36
      </div>
    </div>
  );
};

export default DeckEdit;
