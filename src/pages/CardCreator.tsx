import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Copy, Download, Upload, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

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

const COLORS = ["SILVER", "BLUE", "BLACK", "GREEN", "PURPLE", "RED", "ORANGE", "YELLOW", "PINK", "WHITE"];
const RARITIES = ["COMMON", "UNCOMMON", "RARE", "VERY RARE", "SLAM"];
const TYPES = [
  // Gender/Character Types
  "MALE", "FEMALE", 
  // Role Types
  "HERO", "VILLAIN", "CRIMINAL", "POLITICIAN", "LAWYER",
  // Species/Form Types
  "ANIMAL", "MONSTER", "DROID", "CLONE", "MINION",
  // Object Types
  "VEHICLE", "PROP", "PLACE",
  // Royal Types
  "PRINCESS", "PRINCE", "KING", "QUEEN", "NOBLE", "CONSORT",
  // Special Types
  "ELEMENTAL", "SPIRIT", "CAMEO", "GLITCH",
  // Franchise-Specific Types
  "JEDI", "SITH", "SAIYAN", "NAMEKIAN", "AVATAR", "GAANG", "FAIRY TALE CHARACTER"
];

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
  WHITE: "bg-white border border-gray-300",
};

// Common power patterns for cards - organized by category
const POWER_PATTERNS = [
  // No Power
  { label: "No Power", template: "No power", category: "basic" },
  
  // Self-Modifying: Conditional Bonuses
  { label: "+X if [Card] in play", template: "+{points} if any {cardName} is in play", category: "conditional" },
  { label: "+X if [A] and [B] both in play", template: "+{points} if {cardA} and {cardB} are both in play", category: "conditional" },
  { label: "+X if next to [Card]", template: "+{points} if next to any {cardName}", category: "conditional" },
  { label: "+X if adjacent to [Type]", template: "+{points} if adjacent to a {type}", category: "conditional" },
  { label: "+X if played in 2nd round", template: "+{points} if played in the 2nd round", category: "conditional" },
  { label: "+X if played first in first round", template: "+{points} if played first in the first round", category: "conditional" },
  { label: "+X if played as last card", template: "+{points} if played as the last card", category: "conditional" },
  { label: "+X if other [Type] in play", template: "+{points} if any other {type} is in play", category: "conditional" },
  
  // Self-Modifying: Multipliers
  { label: "x2 if [Card] in play", template: "x2 if {cardName} is in play", category: "multiplier" },
  { label: "x2 if next to [Card]", template: "x2 if next to any {cardName}", category: "multiplier" },
  { label: "x3 if next to [Type]", template: "x3 if next to another {type}", category: "multiplier" },
  { label: "x2 if opposite is [Color]", template: "x2 if opposite card is {color}", category: "multiplier" },
  { label: "x2 if [A] or [B] in play", template: "x2 if {cardA} or {cardB} is in play", category: "multiplier" },
  
  // Self-Modifying: Count-Based
  { label: "+X for each [Type]", template: "+{points} for each {type} in play", category: "counting" },
  { label: "+X for each other [Type]", template: "+{points} for each other {type} in play", category: "counting" },
  { label: "+X for each neighboring [Type]", template: "+{points} for each neighboring {type}", category: "counting" },
  { label: "+X for each [Type] opponent", template: "+{points} for each {type} opponent", category: "counting" },
  { label: "-X for each opponent [Type]", template: "-{points} for each opponent {type}", category: "counting" },
  
  // Buff Other Cards
  { label: "+X to neighboring cards", template: "+{points} to neighboring cards", category: "buff" },
  { label: "+X to all [Color] cards", template: "+{points} to all {color} cards", category: "buff" },
  { label: "+X to all [Group] members", template: "+{points} to all {group} members", category: "buff" },
  { label: "+X to each [Type]", template: "+{points} to each {type}", category: "buff" },
  { label: "x2 to neighboring [Type]", template: "x2 to each neighboring {type}", category: "buff" },
  { label: "+X to cards with lower base", template: "+{points} to each own card with lower base value", category: "buff" },
  
  // Debuff Opponents
  { label: "-X to opposite card", template: "-{points} to opposite card", category: "debuff" },
  { label: "-X to opposing [Type]", template: "-{points} to each opposing {type}", category: "debuff" },
  { label: "-X to opposing if not [Type]", template: "-{points} to opposite card if not a {type}", category: "debuff" },
  { label: "-X to opposing higher base", template: "-{points} to each opposing card with higher base value", category: "debuff" },
  { label: "-X to each [Type]", template: "-{points} to each {type}", category: "debuff" },
  
  // Special/Complex (existing)
  { label: "Cancels opposite [Type]", template: "Cancels opposite card if it is a {type}", category: "special" },
  { label: "All [Type] get +X per [Target]", template: "All {type} get +{points} for each {target} in play", category: "special" },
  { label: "+X to [Card] if adjacent to [Card]", template: "+{points} to {cardA} if adjacent to {cardB}", category: "special" },
  
  // === NEW EFFECTS ===
  
  // Defensive Effects
  { label: "Cannot be cancelled (Shield)", template: "Cannot be cancelled", category: "defensive" },
  { label: "Immune to cancellation", template: "Immune to cancellation and negative effects", category: "defensive" },
  { label: "Immune to negative effects", template: "Immune to negative effects", category: "defensive" },
  { label: "Shielded", template: "Shielded - this card cannot be cancelled", category: "defensive" },
  
  // Steal Effects
  { label: "Steal X from opposite", template: "Steal {points} points from opposing card", category: "steal" },
  { label: "Steal X from all opponents", template: "Steal {points} points from all opposing cards", category: "steal" },
  { label: "Steal buff from opposite", template: "Steal random buff from opposite toon", category: "steal" },
  { label: "Steal effect from opposite", template: "Steal the effect from opposite card", category: "steal" },
  
  // Double Effects
  { label: "Double effect to the left", template: "Double the effect of the card to the left", category: "amplify" },
  { label: "Double effect to the right", template: "Double the effect of the card to the right", category: "amplify" },
  
  // Random Cancel
  { label: "Cancel random opponent", template: "Cancel a random opponent's gtoon", category: "special" },
  
  // Swap/Copy Effects
  { label: "Swap points with neighbor", template: "Swap points with a neighboring card", category: "swap" },
  { label: "Swap points with [Type]", template: "Swap points with neighboring {type}", category: "swap" },
  { label: "Copy base points of [Type]", template: "Copy the base points of another {type}", category: "swap" },
  { label: "Mirror opposing effect", template: "Mirror opposing card's effect", category: "swap" },
  
  // Position-Based Effects
  { label: "+X if in corner", template: "+{points} if placed in corner", category: "position" },
  { label: "+X if in center", template: "+{points} if placed in center", category: "position" },
  { label: "+X per adjacent filled slot", template: "+{points} for each adjacent filled slot", category: "position" },
  
  // Underdog/Comeback Effects
  { label: "+X if total lower (Underdog)", template: "+{points} if your total is lower than opponent's", category: "underdog" },
  { label: "x2 if total lower", template: "x2 if your total is lower than opponent's", category: "underdog" },
  { label: "x2 if only non-cancelled (Last Stand)", template: "x2 if this is your only non-cancelled card", category: "underdog" },
  
  // Random/Gamble Effects
  { label: "Random +1 to +5", template: "Randomly gain +1 to +5 points", category: "random" },
  { label: "Random +1 to +10", template: "Randomly gain +1 to +10 points", category: "random" },
  { label: "Random +5 to +15", template: "Randomly gain +5 to +15 points", category: "random" },
  
  // Sacrifice/Chain Effects
  { label: "Sacrifice for +X to all", template: "Cancel this card to give +{points} to all your other cards", category: "chain" },
  { label: "Double neighbor effects (Echo)", template: "Double each neighboring card's effect", category: "chain" },
  { label: "+X per triggered effect (Amplify)", template: "+{points} for each card with a triggered effect", category: "chain" },
  { label: "+X per negative on your cards (Counter)", template: "+{points} for each negative effect on your cards", category: "chain" },
  
  // Color Manipulation Effects
  { label: "Change color condition to [Color]", template: "Change the color condition to {color}", category: "color" },
  { label: "Counts as all colors", template: "This card counts as all colors", category: "color" },
  { label: "Convert [Color] to [Color]", template: "Convert all {colorA} cards to {colorB}", category: "color" },
  { label: "Negate color bonus", template: "Negate the color bonus this round", category: "color" },
  
  // Hand/Resource Effects
  { label: "+X per card in hand", template: "+{points} for each card still in your hand", category: "resource" },
  { label: "+X per opponent card in hand", template: "+{points} for each card in opponent's hand", category: "resource" },
  
  // Advanced Position Effects
  { label: "Swap positions with opposite", template: "Swap board positions with opposite card", category: "position" },
  { label: "Move to empty slot", template: "Move this card to an empty slot", category: "position" },
  
  // Win Condition Manipulation
  { label: "Reverse scoring this round", template: "Reverse scoring - lowest total wins this round", category: "special" },
  { label: "Lock this slot", template: "Lock this slot - this card cannot be affected", category: "defensive" },
  
  // Echo/Chain Effects
  { label: "Echo base to neighbors", template: "Copy this card's base points to neighboring cards", category: "chain" },
  { label: "Chain +X on win", template: "If this card wins its matchup, give +{points} to next card", category: "chain" },
  { label: "Sabotage all opponents", template: "Reduce all opponent cards by {points} points", category: "debuff" },
];

const COMMON_GROUPS = [
  "JUSTICE LEAGUE", "TEEN TITANS", "POWERPUFF GIRLS", "LOONEY TUNES",
  "CLONE WARS", "DRAGON BALL Z", "KUNG FU PANDA", "DESPICABLE ME",
  "FROZEN", "AVATAR", "SPONGEBOB", "SHREK", "CARS", "PHINEAS FERB",
  "WRECK-IT RALPH", "ZOOTOPIA", "ED EDD N EDDY", "MYSTERY, INC.",
  "INJUSTICE GANG", "IMAGINARY FRIEND", "BEAN SCOUTS", "MUCHA LUCHA"
];

const emptyCard: Omit<CardData, "id"> = {
  title: "",
  character: "",
  basePoints: 5,
  points: 5,
  colors: [],
  description: "No power",
  rarity: "COMMON",
  groups: [],
  types: [],
};

export default function CardCreator() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [cards, setCards] = useState<CardData[]>([]);
  const [currentCard, setCurrentCard] = useState<Omit<CardData, "id">>(emptyCard);
  const [newGroup, setNewGroup] = useState("");
  const [nextId, setNextId] = useState(1000); // Start custom cards at ID 1000

  const addCard = () => {
    if (!currentCard.title) {
      toast.error("Card needs a title");
      return;
    }
    if (currentCard.colors.length === 0) {
      toast.error("Card needs at least one color");
      return;
    }

    const newCard: CardData = {
      ...currentCard,
      id: nextId,
      points: currentCard.basePoints,
    };

    setCards([...cards, newCard]);
    setNextId(nextId + 1);
    setCurrentCard(emptyCard);
    toast.success("Card added to list");
  };

  const removeCard = (id: number) => {
    setCards(cards.filter((c) => c.id !== id));
  };

  const toggleColor = (color: string) => {
    setCurrentCard((prev) => ({
      ...prev,
      colors: prev.colors.includes(color)
        ? prev.colors.filter((c) => c !== color)
        : [...prev.colors, color],
    }));
  };

  const toggleType = (type: string) => {
    setCurrentCard((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  const addGroup = () => {
    if (newGroup && !currentCard.groups.includes(newGroup.toUpperCase())) {
      setCurrentCard((prev) => ({
        ...prev,
        groups: [...prev.groups, newGroup.toUpperCase()],
      }));
      setNewGroup("");
    }
  };

  const removeGroup = (group: string) => {
    setCurrentCard((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g !== group),
    }));
  };

  const applyPowerPattern = (template: string) => {
    setCurrentCard((prev) => ({
      ...prev,
      description: template,
    }));
  };

  const exportJSON = () => {
    const json = JSON.stringify(cards, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "custom-cards.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Cards exported!");
  };

  const copyJSON = () => {
    const json = JSON.stringify(cards, null, 2);
    navigator.clipboard.writeText(json);
    toast.success("JSON copied to clipboard!");
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Admin access required</p>
        <Link to="/home">
          <Button>Go Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Card Creator</h1>
              <p className="text-sm text-muted-foreground">
                {cards.length} cards created
              </p>
            </div>
          </div>
          {cards.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyJSON}>
                <Copy className="w-4 h-4 mr-2" />
                Copy JSON
              </Button>
              <Button onClick={exportJSON}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground">Create New Card</h2>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Card Title *</Label>
                <Input
                  value={currentCard.title}
                  onChange={(e) =>
                    setCurrentCard((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. Super Hero"
                />
              </div>
              <div className="space-y-2">
                <Label>Character Name</Label>
                <Input
                  value={currentCard.character}
                  onChange={(e) =>
                    setCurrentCard((prev) => ({ ...prev, character: e.target.value }))
                  }
                  placeholder="e.g. Super Hero (leave empty to use title)"
                />
              </div>
            </div>

            {/* Points & Rarity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Points</Label>
                <Input
                  type="number"
                  value={currentCard.basePoints}
                  onChange={(e) =>
                    setCurrentCard((prev) => ({
                      ...prev,
                      basePoints: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={1}
                  max={15}
                />
              </div>
              <div className="space-y-2">
                <Label>Rarity</Label>
                <Select
                  value={currentCard.rarity}
                  onValueChange={(value) =>
                    setCurrentCard((prev) => ({ ...prev, rarity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RARITIES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-2">
              <Label>Colors * (click to toggle)</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => toggleColor(color)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                      currentCard.colors.includes(color)
                        ? `${colorBg[color]} text-white ring-2 ring-accent ring-offset-2`
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            {/* Types */}
            <div className="space-y-2">
              <Label>Types (click to toggle)</Label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                      currentCard.types.includes(type)
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Groups */}
            <div className="space-y-2">
              <Label>Groups (e.g. JUSTICE LEAGUE, POWERPUFF GIRLS)</Label>
              <div className="flex gap-2">
                <Input
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="Enter group name or click below"
                  onKeyDown={(e) => e.key === "Enter" && addGroup()}
                />
                <Button onClick={addGroup} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {/* Quick group buttons */}
              <div className="flex flex-wrap gap-1">
                {COMMON_GROUPS.map((group) => (
                  <Button
                    key={group}
                    variant="ghost"
                    size="sm"
                    className={`text-xs h-6 px-2 ${
                      currentCard.groups.includes(group) 
                        ? "bg-accent text-accent-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      if (currentCard.groups.includes(group)) {
                        removeGroup(group);
                      } else {
                        setCurrentCard((prev) => ({
                          ...prev,
                          groups: [...prev.groups, group],
                        }));
                      }
                    }}
                  >
                    {group}
                  </Button>
                ))}
              </div>
              {currentCard.groups.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentCard.groups.map((group) => (
                    <Badge key={group} variant="secondary" className="gap-1">
                      {group}
                      <button onClick={() => removeGroup(group)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Power/Description */}
            <div className="space-y-3">
              <Label>Power Description</Label>
              <Textarea
                value={currentCard.description}
                onChange={(e) =>
                  setCurrentCard((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe the card's power..."
                rows={3}
              />
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Quick patterns (click to apply):</p>
                
                {/* Conditional Bonuses */}
                <div className="space-y-1">
                  <p className="text-xs text-primary">Conditional (+X if...)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "conditional").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Multipliers */}
                <div className="space-y-1">
                  <p className="text-xs text-orange-400">Multipliers (x2, x3...)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "multiplier").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Counting */}
                <div className="space-y-1">
                  <p className="text-xs text-yellow-400">Count-Based (+X for each...)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "counting").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Buffs */}
                <div className="space-y-1">
                  <p className="text-xs text-green-400">Buff Others (+X to...)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "buff").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Debuffs */}
                <div className="space-y-1">
                  <p className="text-xs text-red-400">Debuff Opponents (-X to...)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "debuff").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Special */}
                <div className="space-y-1">
                  <p className="text-xs text-purple-400">Special / Complex</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "special" || p.category === "basic").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* NEW EFFECT CATEGORIES */}
                
                {/* Defensive */}
                <div className="space-y-1">
                  <p className="text-xs text-cyan-400">🛡️ Defensive (Shield, Immunity)</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "defensive").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Steal */}
                <div className="space-y-1">
                  <p className="text-xs text-rose-400">💀 Steal Effects</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "steal").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Swap/Copy */}
                <div className="space-y-1">
                  <p className="text-xs text-indigo-400">🔄 Swap / Copy / Mirror</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "swap").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Position */}
                <div className="space-y-1">
                  <p className="text-xs text-teal-400">📍 Position-Based</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "position").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Underdog */}
                <div className="space-y-1">
                  <p className="text-xs text-amber-400">🔥 Underdog / Comeback</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "underdog").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Random */}
                <div className="space-y-1">
                  <p className="text-xs text-emerald-400">🎲 Random / Gamble</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "random").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Chain/Combo */}
                <div className="space-y-1">
                  <p className="text-xs text-fuchsia-400">⚡ Chain / Combo Effects</p>
                  <div className="flex flex-wrap gap-1">
                    {POWER_PATTERNS.filter(p => p.category === "chain").map((pattern) => (
                      <Button
                        key={pattern.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyPowerPattern(pattern.template)}
                      >
                        {pattern.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Add Button */}
            <Button onClick={addCard} className="w-full" size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Add Card to List
            </Button>
          </div>
        </div>

        {/* Created Cards List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Created Cards</h2>
          
          {cards.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
              No cards created yet. Use the form to create cards.
            </div>
          ) : (
            <div className="space-y-3">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="bg-card rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-foreground">{card.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        ID: {card.id} • {card.basePoints} pts • {card.rarity}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCard(card.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {card.colors.map((color) => (
                      <span
                        key={color}
                        className={`w-4 h-4 rounded ${colorBg[color]}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                  {card.types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {card.types.map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {cards.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">JSON Preview</h3>
              <pre className="text-xs text-muted-foreground overflow-auto max-h-64 bg-background p-2 rounded">
                {JSON.stringify(cards, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
