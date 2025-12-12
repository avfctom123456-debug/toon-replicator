import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useOrbitMode } from "@/hooks/useOrbitMode";
import { useUserCards } from "@/hooks/useUserCards";
import { useCZone, CZonePlacement, CZoneUser } from "@/hooks/useCZone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Settings, Palette, Hammer, X, Trash2, 
  ChevronLeft, ChevronRight, Shuffle, Coins, Save, Eye
} from "lucide-react";
import cardsData from "@/data/cards.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

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
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { orbitModeEnabled, czoneBackground, backgrounds, updateBackground, loading: orbitLoading } = useOrbitMode();
  const { userCards } = useUserCards();
  const { 
    placements, 
    todayPoints, 
    allUsers, 
    fetchPlacements, 
    savePlacement, 
    updatePlacement,
    deletePlacement,
    clearAllPlacements,
    visitCZone,
    loading: czoneLoading 
  } = useCZone();
  
  const [buildMode, setBuildMode] = useState(false);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Browse mode state
  const [browseMode, setBrowseMode] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [browsePlacements, setBrowsePlacements] = useState<CZonePlacement[]>([]);
  const [browseUser, setBrowseUser] = useState<CZoneUser | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

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

  const loadBrowseUser = useCallback(async (index: number) => {
    if (allUsers.length === 0) return;
    
    const userToView = allUsers[index];
    setBrowseUser(userToView);
    
    const userPlacements = await fetchPlacements(userToView.user_id);
    setBrowsePlacements(userPlacements);
    
    // Auto-visit for points
    await visitCZone(userToView.user_id);
  }, [allUsers, fetchPlacements, visitCZone]);

  const handlePrevious = () => {
    const newIndex = browseIndex > 0 ? browseIndex - 1 : allUsers.length - 1;
    setBrowseIndex(newIndex);
    loadBrowseUser(newIndex);
  };

  const handleNext = () => {
    const newIndex = browseIndex < allUsers.length - 1 ? browseIndex + 1 : 0;
    setBrowseIndex(newIndex);
    loadBrowseUser(newIndex);
  };

  const handleRandom = () => {
    if (allUsers.length <= 1) return;
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * allUsers.length);
    } while (newIndex === browseIndex);
    setBrowseIndex(newIndex);
    loadBrowseUser(newIndex);
  };

  const enterBrowseMode = () => {
    if (allUsers.length === 0) {
      toast.error("No other cZones to browse yet!");
      return;
    }
    setBrowseMode(true);
    setBrowseIndex(0);
    loadBrowseUser(0);
  };

  const exitBrowseMode = () => {
    setBrowseMode(false);
    setBrowseUser(null);
    setBrowsePlacements([]);
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!buildMode || !selectedCard || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    await savePlacement({
      card_id: selectedCard,
      x_position: Math.max(5, Math.min(95, x)),
      y_position: Math.max(5, Math.min(95, y)),
      z_index: placements.length + 1,
      scale: 1
    });
    
    setSelectedCard(null);
  };

  const handleDragStart = (e: React.MouseEvent, placement: CZonePlacement) => {
    if (!buildMode) return;
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    setDraggingId(placement.id);
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left - dragOffset.x) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top - dragOffset.y) / rect.height) * 100);
    
    updatePlacement(draggingId, {
      x_position: Math.max(5, Math.min(95, x)),
      y_position: Math.max(5, Math.min(95, y))
    });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDeletePlacement = async (id: string) => {
    await deletePlacement(id);
    toast.success("Card removed");
  };

  if (authLoading || orbitLoading || czoneLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !orbitModeEnabled) return null;

  const displayPlacements = browseMode ? browsePlacements : placements;
  const displayBackground = browseMode 
    ? (browseUser?.czone_background || "dexter") 
    : czoneBackground;
  const displayUsername = browseMode 
    ? browseUser?.username 
    : profile?.username;
  
  const bgStyle = backgroundStyles[displayBackground] || backgroundStyles.dexter;
  const getCard = (id: number) => (cardsData as any[]).find(c => c.id === id);

  // Group user cards for collection picker
  const uniqueCards = userCards?.reduce((acc, uc) => {
    if (!acc.find(c => c.card_id === uc.card_id)) {
      acc.push(uc);
    }
    return acc;
  }, [] as typeof userCards) || [];

  return (
    <div 
      className={`min-h-screen bg-gradient-to-br ${bgStyle}`}
      onMouseMove={draggingId ? handleDrag : undefined}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/home")}
              className="text-white hover:bg-white/10 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">
                {browseMode ? `${displayUsername}'s cZone` : "My cZone"}
              </h1>
              <p className="text-[10px] text-white/60">
                {backgrounds.find(b => b.slug === displayBackground)?.name || "Dexter's Lab"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Points Display */}
            <div className="bg-yellow-500/20 px-3 py-1 rounded-full flex items-center gap-1">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{todayPoints}/200</span>
            </div>
            
            {!browseMode && !buildMode && (
              <>
                <Button
                  size="sm"
                  onClick={() => setBuildMode(true)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Hammer className="w-4 h-4 mr-1" />
                  Build
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={enterBrowseMode}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Browse
                </Button>
              </>
            )}
            
            {buildMode && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setBackgroundPickerOpen(true)}
                >
                  <Palette className="w-4 h-4 mr-1" />
                  BG
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCollectionOpen(true)}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Cards
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Clear all cards from your cZone?")) {
                      clearAllPlacements();
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBuildMode(false);
                    setSelectedCard(null);
                    toast.success("cZone saved!");
                  }}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Done
                </Button>
              </>
            )}
            
            {browseMode && (
              <Button
                size="sm"
                variant="secondary"
                onClick={exitBrowseMode}
              >
                <X className="w-4 h-4 mr-1" />
                Exit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Browse Navigation */}
      {browseMode && (
        <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrevious}
              className="text-white hover:bg-white/10"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Previous
            </Button>
            <span className="text-white/60 text-sm">
              {browseIndex + 1} of {allUsers.length}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNext}
              className="text-white hover:bg-white/10"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRandom}
              className="text-white hover:bg-white/10"
            >
              <Shuffle className="w-4 h-4 mr-1" />
              Random
            </Button>
          </div>
        </div>
      )}

      {/* Selected Card Indicator */}
      {buildMode && selectedCard && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
          <span className="text-sm">Click on the canvas to place:</span>
          <img 
            src={getCard(selectedCard)?.image} 
            alt="" 
            className="w-8 h-8 rounded-full border-2 border-white"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedCard(null)}
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div className="max-w-6xl mx-auto p-4">
        <div 
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`relative bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden ${
            buildMode ? "cursor-crosshair" : ""
          }`}
          style={{ height: "60vh", minHeight: "400px" }}
        >
          {/* Grid pattern for build mode */}
          {buildMode && (
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "5% 5%"
              }}
            />
          )}

          {/* Placed Cards */}
          {displayPlacements.map((placement) => {
            const card = getCard(placement.card_id);
            if (!card) return null;
            
            return (
              <div
                key={placement.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-shadow ${
                  buildMode ? "cursor-move hover:ring-4 hover:ring-green-400" : ""
                } ${draggingId === placement.id ? "ring-4 ring-green-400 z-50" : ""}`}
                style={{
                  left: `${placement.x_position}%`,
                  top: `${placement.y_position}%`,
                  zIndex: placement.z_index,
                  transform: `translate(-50%, -50%) scale(${placement.scale})`
                }}
                onMouseDown={(e) => handleDragStart(e, placement)}
              >
                <div className="relative group">
                  <img 
                    src={card.image} 
                    alt={card.title}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/50 shadow-lg"
                    draggable={false}
                  />
                  {buildMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlacement(placement.id);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {displayPlacements.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
              {browseMode ? (
                <p>This cZone is empty</p>
              ) : buildMode ? (
                <>
                  <p>Click "Cards" to load your collection</p>
                  <p className="text-sm mt-1">Then click here to place them!</p>
                </>
              ) : (
                <>
                  <p>Your cZone is empty</p>
                  <p className="text-sm mt-1">Click "Build" to design it!</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="mt-4 flex justify-center gap-4">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <div className="text-xl font-bold text-white">{displayPlacements.length}</div>
            <div className="text-xs text-white/60">Cards Placed</div>
          </div>
          {!browseMode && (
            <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
              <div className="text-xl font-bold text-white">{uniqueCards.length}</div>
              <div className="text-xs text-white/60">In Collection</div>
            </div>
          )}
        </div>
      </div>

      {/* Background Picker Dialog */}
      <Dialog open={backgroundPickerOpen} onOpenChange={setBackgroundPickerOpen}>
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
                  setBackgroundPickerOpen(false);
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

      {/* Collection Picker Dialog */}
      <Dialog open={collectionOpen} onOpenChange={setCollectionOpen}>
        <DialogContent className="bg-[hsl(220,50%,15%)] border-[hsl(220,40%,30%)] max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Select a Card to Place
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[50vh] mt-4">
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 p-1">
              {uniqueCards.map((uc) => {
                const card = getCard(uc.card_id);
                if (!card) return null;
                
                return (
                  <button
                    key={uc.id}
                    onClick={() => {
                      setSelectedCard(uc.card_id);
                      setCollectionOpen(false);
                    }}
                    className={`p-1 rounded-lg border-2 transition-all hover:scale-105 ${
                      selectedCard === uc.card_id
                        ? "border-green-400 bg-green-400/20"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-full aspect-square rounded-full object-cover"
                    />
                    <p className="text-[9px] text-white/70 truncate mt-1 text-center">
                      {card.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CZone;
