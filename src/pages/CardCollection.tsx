import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FullCard } from "@/components/CardDisplay";
import { useAuth } from "@/hooks/useAuth";
import { useUserCards } from "@/hooks/useUserCards";
import { useProfile } from "@/hooks/useProfile";
import { useCardOverrides } from "@/hooks/useCardOverrides";
import { useWishlist } from "@/hooks/useWishlist";
import { getStarterDeckBySlot } from "@/lib/starterDecks";
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

const allCards = cardsData as CardData[];
const allColors = [...new Set(allCards.flatMap(c => c.colors))].sort();
const allRarities = [...new Set(allCards.map(c => c.rarity))].sort();

function CollectionCardImage({ card, bgColor, customImageUrl }: { card: CardData; bgColor: string; customImageUrl?: string | null }) {
  const [imageError, setImageError] = useState(false);
  const defaultImageUrl = `${IMAGE_BASE_URL}/${card.id}.jpg`;
  const imageUrl = customImageUrl || defaultImageUrl;

  return (
    <div className={`aspect-square rounded-full ${bgColor} overflow-hidden flex items-center justify-center border-4 border-muted shadow-lg`}>
      {!imageError ? (
        <img
          src={imageUrl}
          alt={card.title}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="text-white font-bold text-2xl">{card.title[0]}</span>
      )}
    </div>
  );
}

export default function CardCollection() {
  const { user, loading: authLoading } = useAuth();
  const { getCardQuantity, getCardCopyNumbers, loading: cardsLoading } = useUserCards();
  const { profile, loading: profileLoading } = useProfile();
  const { getOverride } = useCardOverrides();
  const { wishlist, isWishlisted, toggleWishlist } = useWishlist();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [showOwned, setShowOwned] = useState<boolean | null>(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [viewCard, setViewCard] = useState<CardData | null>(null);

  // Get starter deck card IDs for the user's claimed deck
  const starterCardIds = useMemo(() => {
    const ids = new Set<number>();
    if (profile?.starter_deck_claimed) {
      const claimedDeckCards = getStarterDeckBySlot(profile.starter_deck_claimed);
      claimedDeckCards.forEach(id => ids.add(id));
    }
    return ids;
  }, [profile?.starter_deck_claimed]);

  // Check if a card is owned (either from starter deck or user_cards)
  const isCardOwned = (cardId: number): boolean => {
    return starterCardIds.has(cardId) || getCardQuantity(cardId) > 0;
  };

  // Get total quantity (starter = 1, plus any additional from packs)
  const getCardTotalQuantity = (cardId: number): number => {
    const fromStarter = starterCardIds.has(cardId) ? 1 : 0;
    const fromPacks = getCardQuantity(cardId);
    return fromStarter + fromPacks;
  };

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    return allCards
      .filter(card => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          if (!card.title.toLowerCase().includes(query) && 
              !card.character.toLowerCase().includes(query) &&
              !card.description.toLowerCase().includes(query)) {
            return false;
          }
        }
        // Color filter
        if (selectedColor && !card.colors.includes(selectedColor)) {
          return false;
        }
        // Rarity filter
        if (selectedRarity && card.rarity !== selectedRarity) {
          return false;
        }
        // Ownership filter
        if (showOwned === true && !isCardOwned(card.id)) {
          return false;
        }
        if (showOwned === false && isCardOwned(card.id)) {
          return false;
        }
        // Wishlist filter
        if (showWishlist && !isWishlisted(card.id)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [searchQuery, selectedColor, selectedRarity, showOwned, showWishlist, starterCardIds, getCardQuantity, wishlist]);

  const ownedCount = allCards.filter(c => isCardOwned(c.id)).length;

  if (authLoading || cardsLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Please log in to view your collection</p>
        <Link to="/auth">
          <Button>Log In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Card Collection</h1>
            <p className="text-sm text-muted-foreground">
              {ownedCount} / {allCards.length} cards owned
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Ownership filter */}
          <Button
            variant={showOwned === null ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOwned(null)}
          >
            All
          </Button>
          <Button
            variant={showOwned === true ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOwned(true)}
          >
            Owned
          </Button>
          <Button
            variant={showOwned === false ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOwned(false)}
          >
            Not Owned
          </Button>

          {/* Wishlist filter */}
          <Button
            variant={showWishlist ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWishlist(!showWishlist)}
            className="gap-1"
          >
            <Heart className={`w-3 h-3 ${showWishlist ? "fill-current" : ""}`} />
            Wishlist ({wishlist.length})
          </Button>

          <div className="w-px bg-border h-8" />

          {/* Color filter */}
          <Button
            variant={selectedColor === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedColor(null)}
          >
            All Colors
          </Button>
          {allColors.map(color => (
            <Button
              key={color}
              variant={selectedColor === color ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedColor(color === selectedColor ? null : color)}
              className="capitalize"
            >
              {color.toLowerCase()}
            </Button>
          ))}

          <div className="w-px bg-border h-8" />

          {/* Rarity filter */}
          <Button
            variant={selectedRarity === null ? "secondary" : "outline"}
            size="sm"
            onClick={() => setSelectedRarity(null)}
          >
            All Rarities
          </Button>
          {allRarities.map(rarity => (
            <Button
              key={rarity}
              variant={selectedRarity === rarity ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRarity(rarity === selectedRarity ? null : rarity)}
              className="capitalize"
            >
              {rarity.toLowerCase()}
            </Button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredCards.length} cards
        </p>
      </div>

      {/* Card Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCards.map(card => {
            const owned = isCardOwned(card.id);
            const quantity = getCardTotalQuantity(card.id);
            const bgColor = colorBg[card.colors?.[0]] || "bg-gray-500";
            const copyNumbers = getCardCopyNumbers(card.id);
            const lowestCopy = copyNumbers.length > 0 ? Math.min(...copyNumbers) : null;

            // Determine rarity styling based on lowest copy number
            const getCopyRarityStyle = (num: number) => {
              if (num <= 10) return "bg-yellow-500 text-yellow-950";
              if (num <= 50) return "bg-gray-300 text-gray-800";
              return "bg-accent text-accent-foreground";
            };

            const override = getOverride(card.id);
            const customImageUrl = override?.custom_image_url;

            return (
              <div
                key={card.id}
                onClick={() => setViewCard(card)}
                className={`relative bg-card rounded-lg p-3 cursor-pointer transition-all hover:scale-105 ${
                  owned ? "ring-2 ring-accent" : "opacity-40 grayscale"
                }`}
              >
                <CollectionCardImage card={card} bgColor={bgColor} customImageUrl={customImageUrl} />
                
                {/* Wishlist indicator */}
                {isWishlisted(card.id) && (
                  <div className="absolute top-2 right-2 text-red-500">
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                )}
                
                {/* Copy number badge (shows lowest owned) */}
                {owned && lowestCopy && (
                  <div className={`absolute top-2 left-2 ${getCopyRarityStyle(lowestCopy)} text-xs font-bold px-1.5 py-0.5 rounded`}>
                    #{lowestCopy}
                  </div>
                )}

                {/* Quantity badge */}
                {owned && quantity > 1 && !isWishlisted(card.id) && (
                  <div className="absolute top-2 right-2 bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded-full">
                    x{quantity}
                  </div>
                )}

                {/* Card info */}
                <div className="mt-2 text-center">
                  <h3 className="font-semibold text-foreground text-sm truncate">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.basePoints} pts</p>
                  <div className="flex justify-center gap-1 mt-1">
                    {card.colors.map(color => (
                      <span
                        key={color}
                        className={`w-3 h-3 rounded-full ${colorBg[color] || "bg-gray-500"}`}
                      />
                    ))}
                  </div>
                  {/* Show all copy numbers if multiple */}
                  {copyNumbers.length > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Copies: {copyNumbers.map(n => `#${n}`).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full card view modal */}
      {viewCard && (
        <FullCard 
          card={viewCard} 
          onClose={() => setViewCard(null)}
          isWishlisted={isWishlisted(viewCard.id)}
          onToggleWishlist={() => toggleWishlist(viewCard.id)}
          customImageUrl={getOverride(viewCard.id)?.custom_image_url}
        />
      )}
    </div>
  );
}

