import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useOrbitMode } from "@/hooks/useOrbitMode";
import { useCMart } from "@/hooks/useCMart";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, ShoppingCart, Star, Package } from "lucide-react";
import cardsData from "@/data/cards.json";
import { useEffect } from "react";

const CMart = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { orbitModeEnabled, loading: orbitLoading } = useOrbitMode();
  const { listings, loading: listingsLoading, purchaseCard } = useCMart();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!orbitLoading && !orbitModeEnabled) {
      navigate("/home");
    }
  }, [orbitModeEnabled, orbitLoading, navigate]);

  if (authLoading || orbitLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !orbitModeEnabled) return null;

  const getCard = (id: number) => (cardsData as any[]).find(c => c.id === id);

  const featuredListings = listings.filter(l => l.is_featured);
  const regularListings = listings.filter(l => !l.is_featured);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(280,60%,15%)] to-[hsl(280,50%,8%)]">
      {/* Header */}
      <div className="bg-[hsl(280,50%,20%)] border-b border-[hsl(280,40%,30%)] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/home")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-pink-400" />
              <h1 className="text-xl font-bold text-white">cMart</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-yellow-400">{profile?.coins || 0}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Featured Section */}
        {featuredListings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-pink-400 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Featured Cards
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {featuredListings.map((listing) => {
                const card = getCard(listing.card_id);
                if (!card) return null;
                
                return (
                  <div 
                    key={listing.id}
                    className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-xl border-2 border-pink-500/50 p-3 flex flex-col items-center"
                  >
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-20 h-20 rounded-full object-cover border-2 border-pink-400 mb-2"
                    />
                    <h3 className="text-sm font-bold text-white text-center truncate w-full">
                      {card.title}
                    </h3>
                    <p className="text-xs text-pink-300 mb-2">{listing.stock} left</p>
                    <Button
                      size="sm"
                      onClick={() => purchaseCard(listing.id)}
                      disabled={(profile?.coins || 0) < listing.price}
                      className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                    >
                      <Coins className="w-3 h-3 mr-1" />
                      {listing.price}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular Listings */}
        <div>
          <h2 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Available Cards
          </h2>
          
          {listingsLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : listings.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No cards available in the cMart right now.</p>
              <p className="text-sm mt-1">Check back later!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {regularListings.map((listing) => {
                const card = getCard(listing.card_id);
                if (!card) return null;
                
                return (
                  <div 
                    key={listing.id}
                    className="bg-[hsl(280,50%,18%)] rounded-lg border border-[hsl(280,40%,30%)] p-2 flex flex-col items-center"
                  >
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-16 h-16 rounded-full object-cover border border-[hsl(280,40%,40%)] mb-2"
                    />
                    <h3 className="text-xs font-medium text-white text-center truncate w-full">
                      {card.title}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mb-2">{listing.stock} left</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => purchaseCard(listing.id)}
                      disabled={(profile?.coins || 0) < listing.price}
                      className="w-full text-xs h-7"
                    >
                      <Coins className="w-3 h-3 mr-1" />
                      {listing.price}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CMart;
