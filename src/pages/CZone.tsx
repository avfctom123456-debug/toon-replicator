import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useOrbitMode } from "@/hooks/useOrbitMode";
import { useUserCards } from "@/hooks/useUserCards";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Palette } from "lucide-react";
import cardsData from "@/data/cards.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Background gradients for each world
const backgroundStyles: Record<string, string> = {
  dexter: "from-[hsl(200,80%,25%)] via-[hsl(200,60%,35%)] to-[hsl(180,50%,20%)]",
  powerpuff: "from-[hsl(330,60%,30%)] via-[hsl(300,50%,25%)] to-[hsl(280,40%,20%)]",
  johnny: "from-[hsl(35,70%,30%)] via-[hsl(25,60%,25%)] to-[hsl(15,50%,20%)]",
  courage: "from-[hsl(280,50%,20%)] via-[hsl(300,40%,25%)] to-[hsl(320,30%,18%)]",
  ed: "from-[hsl(40,60%,35%)] via-[hsl(50,50%,30%)] to-[hsl(30,40%,22%)]",
  samurai: "from-[hsl(0,0%,15%)] via-[hsl(0,20%,20%)] to-[hsl(0,10%,10%)]",
  grim: "from-[hsl(260,40%,18%)] via-[hsl(280,30%,22%)] to-[hsl(300,20%,15%)]",
  titans: "from-[hsl(220,60%,25%)] via-[hsl(240,50%,30%)] to-[hsl(260,40%,20%)]",
  fosters: "from-[hsl(180,50%,30%)] via-[hsl(200,40%,35%)] to-[hsl(220,30%,25%)]",
};

const CZone = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { orbitModeEnabled, czoneBackground, backgrounds, updateBackground, loading: orbitLoading } = useOrbitMode();
  const { userCards } = useUserCards();
  
  const [viewingProfile, setViewingProfile] = useState<{ username: string; czone_background: string } | null>(null);
  const [viewingCards, setViewingCards] = useState<any[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isOwnProfile = !userId || userId === user?.id;
  const viewingUserId = userId || user?.id;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!orbitLoading && !orbitModeEnabled && isOwnProfile) {
      navigate("/home");
    }
  }, [orbitModeEnabled, orbitLoading, navigate, isOwnProfile]);

  useEffect(() => {
    const fetchViewingData = async () => {
      if (!viewingUserId || isOwnProfile) return;

      const [profileRes, cardsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, czone_background")
          .eq("user_id", viewingUserId)
          .maybeSingle(),
        supabase
          .from("user_cards")
          .select("*")
          .eq("user_id", viewingUserId)
      ]);

      if (profileRes.data) {
        setViewingProfile(profileRes.data);
      }
      if (cardsRes.data) {
        setViewingCards(cardsRes.data);
      }
    };

    fetchViewingData();
  }, [viewingUserId, isOwnProfile]);

  if (authLoading || orbitLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const displayCards = isOwnProfile ? userCards : viewingCards;
  const displayUsername = isOwnProfile ? profile?.username : viewingProfile?.username;
  const displayBackground = isOwnProfile ? czoneBackground : (viewingProfile?.czone_background || "dexter");
  
  const bgStyle = backgroundStyles[displayBackground] || backgroundStyles.dexter;
  const getCard = (id: number) => (cardsData as any[]).find(c => c.id === id);

  // Group cards by unique card_id and count duplicates
  const cardGroups = displayCards?.reduce((acc, uc) => {
    const existing = acc.find((g: any) => g.card_id === uc.card_id);
    if (existing) {
      existing.count += uc.quantity || 1;
    } else {
      acc.push({ card_id: uc.card_id, count: uc.quantity || 1 });
    }
    return acc;
  }, [] as { card_id: number; count: number }[]) || [];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgStyle}`}>
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 px-4 py-3">
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
            <div>
              <h1 className="text-xl font-bold text-white">{displayUsername}'s cZone</h1>
              <p className="text-xs text-white/60">
                {backgrounds.find(b => b.slug === displayBackground)?.name || "Dexter's Lab"} World
              </p>
            </div>
          </div>
          
          {isOwnProfile && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <Settings className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[hsl(220,50%,15%)] border-[hsl(220,40%,30%)]">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Choose Your World
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {backgrounds.map((bg) => (
                    <button
                      key={bg.slug}
                      onClick={() => {
                        updateBackground(bg.slug);
                        setSettingsOpen(false);
                      }}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        czoneBackground === bg.slug
                          ? "border-primary bg-primary/20"
                          : "border-white/20 hover:border-white/40 bg-white/5"
                      }`}
                    >
                      <div className={`w-full h-8 rounded bg-gradient-to-br ${backgroundStyles[bg.slug] || backgroundStyles.dexter} mb-2`} />
                      <span className="text-xs text-white">{bg.name}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Card Display Zone */}
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 p-6 min-h-[60vh]">
          {cardGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/50">
              <p className="text-lg">No cards to display yet</p>
              <p className="text-sm mt-1">Start collecting to fill your cZone!</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 justify-center">
              {cardGroups.slice(0, 50).map((group, idx) => {
                const card = getCard(group.card_id);
                if (!card) return null;
                
                return (
                  <div 
                    key={`${group.card_id}-${idx}`}
                    className="relative group"
                  >
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-white/30 shadow-lg transition-transform group-hover:scale-110 group-hover:border-white/60"
                    />
                    {group.count > 1 && (
                      <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        x{group.count}
                      </span>
                    )}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 px-2 py-0.5 rounded text-[10px] text-white whitespace-nowrap">
                      {card.title}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex justify-center gap-4">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-white">{displayCards?.length || 0}</div>
            <div className="text-xs text-white/60">Total Cards</div>
          </div>
          <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <div className="text-2xl font-bold text-white">{cardGroups.length}</div>
            <div className="text-xs text-white/60">Unique</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CZone;
