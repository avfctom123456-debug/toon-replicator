import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useOrbitMode } from "@/hooks/useOrbitMode";
import { useUserCards } from "@/hooks/useUserCards";
import { useCZone, CZonePlacement, CZoneUser } from "@/hooks/useCZone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, X, Trash2, 
  ChevronLeft, ChevronRight, Shuffle, Coins, Save, Eye,
  Plus, Search, Volume2
} from "lucide-react";
import cardsData from "@/data/cards.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Background gradients fallback for each world
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

// Canvas base dimensions for scaling
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675; // 16:9 aspect ratio

// Card sound effects based on color/type
const getCardSound = (card: any): string | null => {
  if (!card) return null;
  const color = card.color?.toLowerCase();
  // Return a simple beep/boop sound based on color
  // These could be replaced with actual sound URLs later
  return color;
};

const playCardSound = (card: any) => {
  if (!card) return;
  
  // Create a simple synthesized sound based on card properties
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Different frequencies based on card color
  const frequencies: Record<string, number> = {
    red: 440,
    blue: 523,
    green: 392,
    yellow: 587,
    purple: 349,
  };
  
  const color = card.color?.toLowerCase() || 'blue';
  oscillator.frequency.value = frequencies[color] || 440;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
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
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Browse mode state
  const [browseMode, setBrowseMode] = useState(false);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [browsePlacements, setBrowsePlacements] = useState<CZonePlacement[]>([]);
  const [browseUser, setBrowseUser] = useState<CZoneUser | null>(null);
  
  // cZone name/description (display only since we're keeping it simple)
  const [czoneName, setCzoneName] = useState("");
  const [czoneDescription, setCzoneDescription] = useState("");
  
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

  useEffect(() => {
    if (profile?.username) {
      setCzoneName(`${profile.username}'s cZone`);
    }
  }, [profile]);

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

  // Auto-place card in center when selected from picker
  const handleCardSelect = async (cardId: number) => {
    if (!canvasRef.current) return;
    
    // Place in a random position near center
    const randomX = 40 + Math.random() * 20; // 40-60%
    const randomY = 40 + Math.random() * 20; // 40-60%
    
    await savePlacement({
      card_id: cardId,
      x_position: Math.round(randomX),
      y_position: Math.round(randomY),
      z_index: placements.length + 1,
      scale: 1
    });
    
    setCardPickerOpen(false);
    toast.success("Card placed! Drag to reposition.");
  };

  // Mouse drag handlers
  const handleDragStart = (e: React.MouseEvent, placement: CZonePlacement) => {
    if (!buildMode) return;
    e.preventDefault();
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

  // Touch drag handlers for mobile
  const handleTouchStart = (e: React.TouchEvent, placement: CZonePlacement) => {
    if (!buildMode) return;
    e.stopPropagation();
    
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    setDraggingId(placement.id);
    setDragOffset({
      x: touch.clientX - rect.left - rect.width / 2,
      y: touch.clientY - rect.top - rect.height / 2
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingId || !canvasRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((touch.clientX - rect.left - dragOffset.x) / rect.width) * 100);
    const y = Math.round(((touch.clientY - rect.top - dragOffset.y) / rect.height) * 100);
    
    updatePlacement(draggingId, {
      x_position: Math.max(5, Math.min(95, x)),
      y_position: Math.max(5, Math.min(95, y))
    });
  };

  const handleTouchEnd = () => {
    setDraggingId(null);
  };

  const handleDeletePlacement = async (id: string) => {
    await deletePlacement(id);
    toast.success("Card removed");
  };

  const handleCardClick = (card: any, e: React.MouseEvent | React.TouchEvent) => {
    // If not build mode, play sound on click
    if (!buildMode) {
      e.stopPropagation();
      playCardSound(card);
      toast.success(`${card.title} says hello!`, { duration: 1000 });
    }
  };

  const handleSave = () => {
    setBuildMode(false);
    toast.success("cZone saved!");
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
  
  // Get background image URL if available
  const currentBgData = backgrounds.find(b => b.slug === displayBackground);
  const hasImageBg = !!currentBgData?.image_url;

  // Group user cards for collection picker
  const uniqueCards = userCards?.reduce((acc, uc) => {
    if (!acc.find(c => c.card_id === uc.card_id)) {
      acc.push(uc);
    }
    return acc;
  }, [] as typeof userCards) || [];

  // Filter cards by search
  const filteredCards = uniqueCards.filter(uc => {
    const card = getCard(uc.card_id);
    if (!card) return false;
    return card.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div 
      className="min-h-screen bg-[hsl(240,20%,10%)]"
      onMouseMove={draggingId ? handleDrag : undefined}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchMove={draggingId ? handleTouchMove : undefined}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="bg-[hsl(240,20%,15%)] border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/home")}
              className="text-white hover:bg-white/10 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold text-purple-400">
              {buildMode ? "Edit cZone" : browseMode ? `${displayUsername}'s cZone` : "cZone"}
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Points Display */}
            <div className="bg-yellow-500/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{todayPoints}/200</span>
            </div>
            
            {!browseMode && !buildMode && (
              <>
                <Button
                  size="sm"
                  onClick={() => setBuildMode(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Edit cZone
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
        <div className="bg-[hsl(240,20%,12%)] border-b border-white/10 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
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

      {/* Main Content - Canvas + Sidebar layout */}
      <div className="max-w-7xl mx-auto p-4">
        <div className={`flex gap-4 ${buildMode ? 'flex-col lg:flex-row' : ''}`}>
          {/* Canvas */}
          <div className={`${buildMode ? 'flex-1' : 'w-full'}`}>
            {/* Background label */}
            {browseMode && (
              <div className="mb-2 text-center">
                <span className="text-white/60 text-sm">
                  Background: {backgrounds.find(b => b.slug === displayBackground)?.name || displayBackground}
                </span>
              </div>
            )}
            
            <div 
              ref={canvasRef}
              className={`relative rounded-lg border-4 border-[hsl(240,20%,25%)] overflow-hidden ${!hasImageBg ? `bg-gradient-to-br ${bgStyle}` : ''}`}
              style={{ 
                aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                maxHeight: "80vh",
                backgroundImage: hasImageBg ? `url(${currentBgData?.image_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Placed Cards */}
              {displayPlacements.map((placement) => {
                const card = getCard(placement.card_id);
                if (!card) return null;
                
                return (
                  <div
                    key={placement.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-shadow touch-none ${
                      buildMode ? "cursor-move hover:ring-4 hover:ring-purple-400" : "cursor-pointer hover:scale-110 transition-transform"
                    } ${draggingId === placement.id ? "ring-4 ring-purple-400 z-50" : ""}`}
                    style={{
                      left: `${placement.x_position}%`,
                      top: `${placement.y_position}%`,
                      zIndex: draggingId === placement.id ? 100 : placement.z_index,
                      transform: `translate(-50%, -50%) scale(${placement.scale})`
                    }}
                    onMouseDown={(e) => buildMode ? handleDragStart(e, placement) : handleCardClick(card, e)}
                    onTouchStart={(e) => buildMode ? handleTouchStart(e, placement) : handleCardClick(card, e)}
                  >
                    <div className="relative group">
                      <img 
                        src={card.image} 
                        alt={card.title}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border-2 border-white/70 shadow-lg"
                        draggable={false}
                      />
                      {!buildMode && (
                        <div className="absolute -bottom-1 -right-1 bg-purple-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Volume2 className="w-3 h-3 text-white" />
                        </div>
                      )}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                  {browseMode ? (
                    <p>This cZone is empty</p>
                  ) : buildMode ? (
                    <>
                      <p>Click "+ Add Card to cZone" to add cards</p>
                      <p className="text-sm mt-1">Cards will be auto-placed for you to drag!</p>
                    </>
                  ) : (
                    <>
                      <p>Your cZone is empty</p>
                      <p className="text-sm mt-1">Click "Edit cZone" to design it!</p>
                    </>
                  )}
                </div>
              )}

              {/* Click to play hint */}
              {!buildMode && displayPlacements.length > 0 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white/70 text-xs px-3 py-1 rounded-full">
                  Click cards to hear them!
                </div>
              )}
            </div>

            {/* Stats Bar - only in view mode */}
            {!buildMode && (
              <div className="mt-4 flex justify-center gap-4">
                <div className="bg-[hsl(240,20%,15%)] rounded-lg px-4 py-2 text-center border border-white/10">
                  <div className="text-xl font-bold text-white">{displayPlacements.length}</div>
                  <div className="text-xs text-white/60">Cards Placed</div>
                </div>
                {!browseMode && (
                  <div className="bg-[hsl(240,20%,15%)] rounded-lg px-4 py-2 text-center border border-white/10">
                    <div className="text-xl font-bold text-white">{uniqueCards.length}</div>
                    <div className="text-xs text-white/60">In Collection</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar - only in build mode */}
          {buildMode && (
            <div className="w-full lg:w-80 space-y-4">
              {/* cZone Settings Card */}
              <div className="bg-[hsl(240,20%,15%)] rounded-lg border border-white/10 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/80 block mb-1.5">cZone Name</label>
                    <Input
                      value={czoneName}
                      onChange={(e) => setCzoneName(e.target.value)}
                      className="bg-[hsl(240,20%,20%)] border-white/20 text-white"
                      placeholder="My cZone"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/80 block mb-1.5">Description</label>
                    <Textarea
                      value={czoneDescription}
                      onChange={(e) => setCzoneDescription(e.target.value)}
                      className="bg-[hsl(240,20%,20%)] border-white/20 text-white resize-none"
                      placeholder="Describe your cZone..."
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/80 block mb-1.5">Background Image</label>
                    <Select value={czoneBackground} onValueChange={updateBackground}>
                      <SelectTrigger className="bg-[hsl(240,20%,20%)] border-white/20 text-purple-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(240,20%,15%)] border-white/20">
                        {backgrounds.map((bg) => (
                          <SelectItem 
                            key={bg.slug} 
                            value={bg.slug}
                            className="text-white hover:bg-purple-600 focus:bg-purple-600"
                          >
                            {bg.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button
                    onClick={handleSave}
                    className="w-full bg-[hsl(220,60%,35%)] hover:bg-[hsl(220,60%,40%)] text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save cZone
                  </Button>
                </div>
              </div>

              {/* Add Cards Card */}
              <div className="bg-[hsl(240,20%,15%)] rounded-lg border border-white/10 p-4">
                <h3 className="text-white font-semibold mb-3">Add Cards</h3>
                
                <Button
                  onClick={() => setCardPickerOpen(true)}
                  variant="outline"
                  className="w-full border-dashed border-white/30 text-purple-400 hover:bg-white/5"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card to cZone
                </Button>
                
                <p className="text-xs text-white/50 mt-2">
                  Cards are auto-placed - just drag to reposition!
                </p>

                {/* Clear All Button */}
                {placements.length > 0 && (
                  <Button
                    onClick={() => {
                      if (confirm("Clear all cards from your cZone?")) {
                        clearAllPlacements();
                      }
                    }}
                    variant="ghost"
                    className="w-full mt-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Cards
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Picker Dialog */}
      <Dialog open={cardPickerOpen} onOpenChange={setCardPickerOpen}>
        <DialogContent className="bg-white border-0 max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Select a Card</DialogTitle>
          </DialogHeader>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
              placeholder="Search by name or character..."
            />
          </div>
          
          <ScrollArea className="h-[50vh] mt-2">
            <div className="grid grid-cols-3 gap-3 p-1">
              {filteredCards.map((uc) => {
                const card = getCard(uc.card_id);
                if (!card) return null;
                
                return (
                  <button
                    key={uc.id}
                    onClick={() => handleCardSelect(uc.card_id)}
                    className="p-3 rounded-lg border-2 border-gray-200 hover:border-pink-400 hover:bg-pink-50 transition-all"
                  >
                    <img 
                      src={card.image} 
                      alt={card.title}
                      className="w-full aspect-square rounded-lg object-cover"
                    />
                  </button>
                );
              })}
              
              {filteredCards.length === 0 && (
                <div className="col-span-3 py-8 text-center text-gray-500">
                  {uniqueCards.length === 0 
                    ? "No cards in your collection yet!" 
                    : "No cards match your search"}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CZone;
