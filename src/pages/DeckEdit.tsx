import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardListItem, CardDisplay, FullCard } from "@/components/CardDisplay";
import { useDecks } from "@/hooks/useDecks";
import { useAuth } from "@/hooks/useAuth";
import cardsData from "@/data/cards.json";

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

const DeckEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "Player";
  const deckSlot = location.state?.deckSlot || "A";
  const initialCardIds = location.state?.cardIds || [];
  
  const { user } = useAuth();
  const { saveDeck } = useDecks();
  
  const [search, setSearch] = useState("");
  const [selectedCards, setSelectedCards] = useState<number[]>(initialCardIds);
  const [viewCard, setViewCard] = useState<CardData | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredCards = useMemo(() => {
    return (cardsData as CardData[]).filter((c) => 
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.character.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 50);
  }, [search]);

  const toggleCard = (id: number) => {
    if (selectedCards.includes(id)) {
      setSelectedCards(selectedCards.filter(c => c !== id));
    } else if (selectedCards.length < 12) {
      setSelectedCards([...selectedCards, id]);
    }
  };

  const selectedCardData = useMemo(() => {
    return (cardsData as CardData[]).filter(c => selectedCards.includes(c.id));
  }, [selectedCards]);

  const handleSave = async () => {
    if (!user) {
      navigate("/deck-builder", { state: { username } });
      return;
    }
    
    setSaving(true);
    const success = await saveDeck(deckSlot, selectedCards);
    setSaving(false);
    
    if (success) {
      navigate("/deck-builder", { state: { username } });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-foreground mb-2">Edit Deck {deckSlot}</h1>
        <Input
          type="text"
          placeholder="Search characters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Character List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filteredCards.map((card) => (
          <div key={card.id} className="flex gap-2 items-center">
            <div className="flex-1" onClick={() => toggleCard(card.id)}>
              <CardListItem 
                card={card} 
                selected={selectedCards.includes(card.id)}
              />
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setViewCard(card)}
              className="text-muted-foreground"
            >
              View
            </Button>
          </div>
        ))}
      </div>

      {/* Bottom Selection */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-foreground font-bold">{selectedCards.length}/12</span>
          <div className="flex gap-1 flex-1 overflow-x-auto py-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-shrink-0">
                {selectedCardData[i] ? (
                  <CardDisplay 
                    card={selectedCardData[i]} 
                    size="small"
                    onClick={() => toggleCard(selectedCardData[i].id)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <Button 
            variant="link" 
            className="text-foreground underline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
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

      {/* Full Card Viewer */}
      {viewCard && (
        <FullCard card={viewCard} onClose={() => setViewCard(null)} />
      )}

      <div className="fixed bottom-20 left-4 text-muted-foreground text-xs">
        v0.0.37
      </div>
    </div>
  );
};

export default DeckEdit;
