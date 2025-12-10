import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Copy, Download, Upload, Trash2, Search } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// Common power patterns for cards - organized by category with descriptions
const POWER_PATTERNS = [
  // No Power
  { label: "No Power", template: "No power", category: "basic", description: "Card has no special ability", example: "A vanilla card with just base points" },
  
  // Self-Modifying: Conditional Bonuses
  { label: "+X if [Card] in play", template: "+{points} if any {cardName} is in play", category: "conditional", description: "Gains bonus points when a specific card is played by either player", example: "+3 if any Batman is in play" },
  { label: "+X if [A] and [B] both in play", template: "+{points} if {cardA} and {cardB} are both in play", category: "conditional", description: "Requires two specific cards to be in play for bonus", example: "+5 if Superman and Batman are both in play" },
  { label: "+X if next to [Card]", template: "+{points} if next to any {cardName}", category: "conditional", description: "Gains bonus when placed adjacent to a specific card", example: "+4 if next to any Robin" },
  { label: "+X if adjacent to [Type]", template: "+{points} if adjacent to a {type}", category: "conditional", description: "Bonus when next to cards of a specific type", example: "+2 if adjacent to a HERO" },
  { label: "+X if played in 2nd round", template: "+{points} if played in the 2nd round", category: "conditional", description: "Only gains bonus when used in round 2", example: "+6 if played in the 2nd round" },
  { label: "+X if played first in first round", template: "+{points} if played first in the first round", category: "conditional", description: "Must be the first card placed in round 1", example: "+3 if played first in the first round" },
  { label: "+X if played as last card", template: "+{points} if played as the last card", category: "conditional", description: "Bonus applies to the 7th card placed", example: "+5 if played as the last card" },
  { label: "+X if other [Type] in play", template: "+{points} if any other {type} is in play", category: "conditional", description: "Needs another card of same type on the board", example: "+3 if any other VILLAIN is in play" },
  
  // Self-Modifying: Multipliers
  { label: "x2 if [Card] in play", template: "x2 if {cardName} is in play", category: "multiplier", description: "Doubles this card's points when specific card exists", example: "x2 if Joker is in play" },
  { label: "x2 if next to [Card]", template: "x2 if next to any {cardName}", category: "multiplier", description: "Doubles points when adjacent to specific card", example: "x2 if next to any Wonder Woman" },
  { label: "x3 if next to [Type]", template: "x3 if next to another {type}", category: "multiplier", description: "Triples points when next to matching type", example: "x3 if next to another ANIMAL" },
  { label: "x2 if opposite is [Color]", template: "x2 if opposite card is {color}", category: "multiplier", description: "Doubles when facing a card of specific color", example: "x2 if opposite card is RED" },
  { label: "x2 if [A] or [B] in play", template: "x2 if {cardA} or {cardB} is in play", category: "multiplier", description: "Doubles if either of two specific cards exist", example: "x2 if SpongeBob or Patrick is in play" },
  
  // Self-Modifying: Count-Based
  { label: "+X for each [Type]", template: "+{points} for each {type} in play", category: "counting", description: "Scales with total count of a type on both boards", example: "+1 for each FEMALE in play" },
  { label: "+X for each other [Type]", template: "+{points} for each other {type} in play", category: "counting", description: "Counts others of same type, excluding self", example: "+2 for each other JEDI in play" },
  { label: "+X for each neighboring [Type]", template: "+{points} for each neighboring {type}", category: "counting", description: "Only counts adjacent cards of type", example: "+3 for each neighboring CLONE" },
  { label: "+X for each [Type] opponent", template: "+{points} for each {type} opponent", category: "counting", description: "Counts only opponent's cards of type", example: "+2 for each SITH opponent" },
  { label: "-X for each opponent [Type]", template: "-{points} for each opponent {type}", category: "counting", description: "Loses points for each opponent card of type", example: "-1 for each opponent HERO" },
  
  // Buff Other Cards
  { label: "+X to neighboring cards", template: "+{points} to neighboring cards", category: "buff", description: "Buffs all adjacent friendly cards", example: "+2 to neighboring cards" },
  { label: "+X to all [Color] cards", template: "+{points} to all {color} cards", category: "buff", description: "Buffs all friendly cards of a color", example: "+1 to all BLUE cards" },
  { label: "+X to all [Group] members", template: "+{points} to all {group} members", category: "buff", description: "Buffs cards from same franchise group", example: "+2 to all TEEN TITANS members" },
  { label: "+X to each [Type]", template: "+{points} to each {type}", category: "buff", description: "Buffs all friendly cards of a type", example: "+1 to each PRINCESS" },
  { label: "x2 to neighboring [Type]", template: "x2 to each neighboring {type}", category: "buff", description: "Doubles adjacent cards of specific type", example: "x2 to each neighboring MINION" },
  { label: "+X to cards with lower base", template: "+{points} to each own card with lower base value", category: "buff", description: "Buffs your weaker cards", example: "+2 to each own card with lower base value" },
  
  // Debuff Opponents
  { label: "-X to opposite card", template: "-{points} to opposite card", category: "debuff", description: "Reduces the opposing card's points", example: "-3 to opposite card" },
  { label: "-X to opposing [Type]", template: "-{points} to each opposing {type}", category: "debuff", description: "Weakens all opponent cards of a type", example: "-2 to each opposing VILLAIN" },
  { label: "-X to opposing if not [Type]", template: "-{points} to opposite card if not a {type}", category: "debuff", description: "Debuff only if opponent isn't specific type", example: "-4 to opposite card if not a HERO" },
  { label: "-X to opposing higher base", template: "-{points} to each opposing card with higher base value", category: "debuff", description: "Targets strong opponent cards", example: "-2 to each opposing card with higher base value" },
  { label: "-X to each [Type]", template: "-{points} to each {type}", category: "debuff", description: "Reduces all cards of a type (both players)", example: "-1 to each MONSTER" },
  
  // Special/Complex (existing)
  { label: "Cancels opposite [Type]", template: "Cancels opposite card if it is a {type}", category: "special", description: "Nullifies opposing card if it matches type", example: "Cancels opposite card if it is a DROID" },
  { label: "All [Type] get +X per [Target]", template: "All {type} get +{points} for each {target} in play", category: "special", description: "Complex scaling buff for a type", example: "All SAIYAN get +1 for each NAMEKIAN in play" },
  { label: "+X to [Card] if adjacent to [Card]", template: "+{points} to {cardA} if adjacent to {cardB}", category: "special", description: "Conditional buff to specific card pair", example: "+3 to Shaggy if adjacent to Scooby" },
  
  // === NEW EFFECTS ===
  
  // Defensive Effects
  { label: "Cannot be cancelled (Shield)", template: "Cannot be cancelled", category: "defensive", description: "Immune to cancel effects", example: "This card cannot be cancelled by any effect" },
  { label: "Immune to cancellation", template: "Immune to cancellation and negative effects", category: "defensive", description: "Full protection from all negative effects", example: "Completely protected from debuffs and cancels" },
  { label: "Immune to negative effects", template: "Immune to negative effects", category: "defensive", description: "Can't receive point reductions", example: "Debuffs don't affect this card" },
  { label: "Shielded", template: "Shielded - this card cannot be cancelled", category: "defensive", description: "Alternative shield wording", example: "Shielded - this card cannot be cancelled" },
  
  // Steal Effects
  { label: "Steal X from opposite", template: "Steal {points} points from opposing card", category: "steal", description: "Takes points from opposing card and adds to self", example: "Steal 3 points from opposing card" },
  { label: "Steal X from all opponents", template: "Steal {points} points from all opposing cards", category: "steal", description: "Drains points from every opponent card", example: "Steal 1 point from all opposing cards" },
  { label: "Steal buff from opposite", template: "Steal random buff from opposite toon", category: "steal", description: "Takes a positive effect from opponent", example: "Steal random buff from opposite toon" },
  { label: "Steal effect from opposite", template: "Steal the effect from opposite card", category: "steal", description: "Copies and removes opponent's ability", example: "Copy opponent's power and negate theirs" },
  
  // Double Effects
  { label: "Double effect to the left", template: "Double the effect of the card to the left", category: "amplify", description: "Amplifies adjacent left card's power", example: "If left card gives +2, it now gives +4" },
  { label: "Double effect to the right", template: "Double the effect of the card to the right", category: "amplify", description: "Amplifies adjacent right card's power", example: "If right card gives +3, it now gives +6" },
  
  // Random Cancel
  { label: "Cancel random opponent", template: "Cancel a random opponent's gtoon", category: "special", description: "Randomly nullifies one opponent card", example: "One random opponent card scores 0" },
  
  // Swap/Copy Effects
  { label: "Swap points with neighbor", template: "Swap points with a neighboring card", category: "swap", description: "Exchange point values with adjacent card", example: "If you have 3 and neighbor has 7, swap them" },
  { label: "Swap points with [Type]", template: "Swap points with neighboring {type}", category: "swap", description: "Point swap only with specific type neighbor", example: "Swap points with neighboring HERO" },
  { label: "Copy base points of [Type]", template: "Copy the base points of another {type}", category: "swap", description: "Match base points of another card of type", example: "Copy the base points of another SAIYAN" },
  { label: "Mirror opposing effect", template: "Mirror opposing card's effect", category: "swap", description: "Use opponent's ability against them", example: "If opposite has +3 buff, you get +3 too" },
  
  // Position-Based Effects
  { label: "+X if in corner", template: "+{points} if placed in corner", category: "position", description: "Bonus for corner slot placement", example: "+4 if placed in corner" },
  { label: "+X if in center", template: "+{points} if placed in center", category: "position", description: "Bonus for center slot placement", example: "+3 if placed in center" },
  { label: "+X per adjacent filled slot", template: "+{points} for each adjacent filled slot", category: "position", description: "Scales with neighboring card count", example: "+1 for each adjacent filled slot" },
  
  // Underdog/Comeback Effects
  { label: "+X if total lower (Underdog)", template: "+{points} if your total is lower than opponent's", category: "underdog", description: "Bonus when losing before this card", example: "+5 if your total is lower than opponent's" },
  { label: "x2 if total lower", template: "x2 if your total is lower than opponent's", category: "underdog", description: "Doubles when behind in score", example: "Double points when losing" },
  { label: "x2 if only non-cancelled (Last Stand)", template: "x2 if this is your only non-cancelled card", category: "underdog", description: "Doubles if all other cards cancelled", example: "Last card standing gets doubled" },
  
  // Random/Gamble Effects
  { label: "Random +1 to +5", template: "Randomly gain +1 to +5 points", category: "random", description: "RNG bonus in small range", example: "Might get +1, +2, +3, +4, or +5" },
  { label: "Random +1 to +10", template: "Randomly gain +1 to +10 points", category: "random", description: "RNG bonus in medium range", example: "Could get anywhere from +1 to +10" },
  { label: "Random +5 to +15", template: "Randomly gain +5 to +15 points", category: "random", description: "High-risk high-reward RNG", example: "Guaranteed +5, up to +15 possible" },
  
  // Coin Flip Effects
  { label: "Coin Flip: +X or -X", template: "Coin flip: +{points} or -{points}", category: "gamble", description: "50/50 chance to gain or lose points", example: "Coin flip: +5 or -5" },
  { label: "Coin Flip: x2 or x0", template: "Coin flip: double points or zero points", category: "gamble", description: "All or nothing coin flip", example: "Heads doubles, tails scores 0" },
  { label: "Coin Flip: +X or cancel", template: "Coin flip: +{points} or cancel this card", category: "gamble", description: "Win big or get cancelled", example: "Coin flip: +8 or cancel this card" },
  { label: "Coin Flip: buff or debuff", template: "Coin flip: +{points} to all your cards or -{points} to all your cards", category: "gamble", description: "Team-wide coin flip effect", example: "Coin flip: +2 to all or -2 to all" },
  { label: "Coin Flip: steal or give", template: "Coin flip: steal {points} from opposite or give {points} to opposite", category: "gamble", description: "Risky steal attempt", example: "Coin flip: steal 4 or give 4 to opponent" },
  
  // Dice Roll Effects
  { label: "Dice Roll: +1 to +6", template: "Dice roll: gain +1 to +6 points", category: "gamble", description: "Classic D6 roll for bonus points", example: "Roll a die, get that many points" },
  { label: "Dice Roll: -3 to +6", template: "Dice roll: gain -3 to +6 points (1-3 negative, 4-6 positive)", category: "gamble", description: "Risky D6 with negative outcomes", example: "Roll 1-3 loses points, 4-6 gains" },
  { label: "Dice Roll: multiplier", template: "Dice roll: multiply base points by 0 to 3", category: "gamble", description: "Roll determines your multiplier", example: "Roll 1=x0, 2=x0.5, 3=x1, 4=x1.5, 5=x2, 6=x3" },
  { label: "Dice Roll: effect roulette", template: "Dice roll: 1=cancel, 2=-5, 3=0, 4=+3, 5=+6, 6=+10", category: "gamble", description: "Each number triggers different effect", example: "Various outcomes based on roll" },
  { label: "Dice Roll: target", template: "Dice roll: if 4+, +{points} to opposite; if 3-, -{points} to self", category: "gamble", description: "Risky attack that can backfire", example: "High roll buffs opponent, low roll hurts you" },
  { label: "Double Dice: difference", template: "Roll 2 dice: gain the difference as points (can be 0-5)", category: "gamble", description: "Two dice, gain the difference", example: "Roll 6 and 2 = +4 points" },
  
  // High Stakes Gambles
  { label: "All-In Flip", template: "Coin flip: x3 points or cancel all your cards", category: "gamble", description: "Ultimate high stakes gamble", example: "Triple or lose everything" },
  { label: "Lucky 7", template: "Roll 2 dice: if total is 7, +15 points; otherwise -3", category: "gamble", description: "Chase the lucky 7", example: "Hit 7 for jackpot, miss for penalty" },
  { label: "Snake Eyes", template: "Roll 2 dice: if double 1s, cancel opposite; otherwise no effect", category: "gamble", description: "Rare but powerful cancel", example: "1/36 chance to cancel opponent" },
  { label: "Boxcars", template: "Roll 2 dice: if double 6s, +20 points; otherwise lose 1 point per pip shown", category: "gamble", description: "Chase double sixes", example: "Double 6s = +20, else lose roll total" },
  
  // Sacrifice/Chain Effects
  { label: "Sacrifice for +X to all", template: "Cancel this card to give +{points} to all your other cards", category: "chain", description: "Sacrifice self to buff team", example: "Cancel this card to give +2 to all your other cards" },
  { label: "Double neighbor effects (Echo)", template: "Double each neighboring card's effect", category: "chain", description: "Amplifies both adjacent cards", example: "Both neighbors have their effects doubled" },
  { label: "+X per triggered effect (Amplify)", template: "+{points} for each card with a triggered effect", category: "chain", description: "Scales with active effects count", example: "+1 for each card with a triggered effect" },
  { label: "+X per negative on your cards (Counter)", template: "+{points} for each negative effect on your cards", category: "chain", description: "Gets stronger from debuffs", example: "+2 for each negative effect on your cards" },
  
  // Color Manipulation Effects
  { label: "Change color condition to [Color]", template: "Change the color condition to {color}", category: "color", description: "Alters the round's winning color", example: "Change the color condition to BLUE" },
  { label: "Counts as all colors", template: "This card counts as all colors", category: "color", description: "Wild card for color bonus", example: "Always gets color bonus regardless of condition" },
  { label: "Convert [Color] to [Color]", template: "Convert all {colorA} cards to {colorB}", category: "color", description: "Mass color change effect", example: "Convert all RED cards to BLUE" },
  { label: "Negate color bonus", template: "Negate the color bonus this round", category: "color", description: "No one gets color points this round", example: "Color matching gives no bonus" },
  
  // Hand/Resource Effects
  { label: "+X per card in hand", template: "+{points} for each card still in your hand", category: "resource", description: "Rewards holding cards", example: "+1 for each card still in your hand" },
  { label: "+X per opponent card in hand", template: "+{points} for each card in opponent's hand", category: "resource", description: "Scales with opponent's unplayed cards", example: "+2 for each card in opponent's hand" },
  
  // Advanced Position Effects
  { label: "Swap positions with opposite", template: "Swap board positions with opposite card", category: "position", description: "Exchange slots with opposing card", example: "Your card and opposite card swap places" },
  { label: "Move to empty slot", template: "Move this card to an empty slot", category: "position", description: "Relocate to unfilled position", example: "Can move to any empty board slot" },
  
  // Win Condition Manipulation
  { label: "Reverse scoring this round", template: "Reverse scoring - lowest total wins this round", category: "special", description: "Inverts win condition for the round", example: "Player with lower score wins instead" },
  { label: "Lock this slot", template: "Lock this slot - this card cannot be affected", category: "defensive", description: "Complete slot immunity", example: "Nothing can target this card position" },
  
  // Echo/Chain Effects
  { label: "Echo base to neighbors", template: "Copy this card's base points to neighboring cards", category: "chain", description: "Neighbors get this card's base as bonus", example: "If base is 5, neighbors get +5" },
  { label: "Chain +X on win", template: "If this card wins its matchup, give +{points} to next card", category: "chain", description: "Victory bonus passes to next slot", example: "If this card wins its matchup, give +3 to next card" },
  { label: "Sabotage all opponents", template: "Reduce all opponent cards by {points} points", category: "debuff", description: "Mass opponent debuff", example: "Reduce all opponent cards by 2 points" },
  
  // === MATCH-BASED CONDITIONS ===
  { label: "If played first this round", template: "+{points} if played first this round", category: "match", description: "Bonus for being the first card placed in current round", example: "+4 if played first this round" },
  { label: "If played second this round", template: "+{points} if played second this round", category: "match", description: "Bonus for being the second card placed", example: "+3 if played second this round" },
  { label: "If your score is higher", template: "+{points} if your current score is higher than opponent's", category: "match", description: "Bonus when winning before this card resolves", example: "+5 if your current score is higher than opponent's" },
  { label: "If your score is lower", template: "+{points} if your current score is lower than opponent's", category: "match", description: "Comeback bonus when behind", example: "+7 if your current score is lower than opponent's" },
  { label: "If R1 score higher", template: "+{points} if your round 1 score was higher than opponent's", category: "match", description: "Reward for winning round 1", example: "+4 if your round 1 score was higher" },
  { label: "If R1 score lower", template: "+{points} if your round 1 score was lower than opponent's", category: "match", description: "Round 2 comeback mechanic", example: "+7 if your round 1 score was lower (underdog bonus)" },
  { label: "x2 if R1 score lower", template: "x2 if your round 1 score was lower than opponent's", category: "match", description: "Double points for underdogs in round 2", example: "Doubles if you lost round 1" },
  { label: "If this beats opposite", template: "+{points} if this card's score beats opposite card", category: "match", description: "Bonus for winning individual matchup", example: "+3 if this card's score beats opposite card" },
  { label: "x2 if this beats opposite", template: "x2 if this card's score beats opposite card", category: "match", description: "Doubles when winning the slot", example: "Double points if you win this matchup" },
  { label: "If last match was win", template: "+{points} if your last match was a win", category: "match", description: "Win streak bonus from previous game", example: "+3 if your last match was a win" },
  { label: "If last match was loss", template: "+{points} if your last match was a loss", category: "match", description: "Bounce-back bonus after losing", example: "+5 if your last match was a loss" },
  { label: "If drawn first", template: "+{points} if this card was drawn first in your deck", category: "match", description: "Bonus for top-deck card", example: "+4 if this card was drawn first" },
  { label: "If drawn last", template: "+{points} if this card was drawn last in your deck", category: "match", description: "Bonus for bottom-deck card", example: "+4 if this card was drawn last" },
  
  // === POSITION-BASED (EXPANDED) ===
  { label: "If played in slot 1", template: "+{points} if played in slot 1", category: "position", description: "Bonus for first slot placement", example: "+10 if played in slot 1" },
  { label: "If played in slot 2", template: "+{points} if played in slot 2", category: "position", description: "Bonus for second slot placement", example: "+8 if played in slot 2" },
  { label: "If played in slot 3", template: "+{points} if played in slot 3", category: "position", description: "Bonus for third slot placement", example: "+6 if played in slot 3" },
  { label: "If played in slot 4", template: "+{points} if played in slot 4", category: "position", description: "Bonus for fourth slot placement", example: "+5 if played in slot 4" },
  { label: "Different bonus per slot", template: "+{points} in slot 1, +{points2} in slot 2, +{points3} in slot 3", category: "position", description: "Variable bonus based on placement", example: "+10 in slot 1, +5 in slot 2, +2 in slot 3" },
  
  // === OPPONENT DEPENDENT CONDITIONS ===
  { label: "If opposite has higher base", template: "+{points} if opposite card has higher base points", category: "opponent", description: "Giant-slayer bonus vs stronger cards", example: "+5 if opposite card has higher base points" },
  { label: "If opposite has lower base", template: "+{points} if opposite card has lower base points", category: "opponent", description: "Bully bonus vs weaker cards", example: "+2 if opposite card has lower base points" },
  { label: "x2 if opposite has higher base", template: "x2 if opposite card has higher base points", category: "opponent", description: "Double vs stronger opponents", example: "Doubles when facing a stronger card" },
  { label: "If opposite is same color", template: "+{points} if opposite card is the same color", category: "opponent", description: "Color mirror bonus", example: "+4 if opposite card is the same color" },
  { label: "If opposite is different color", template: "+{points} if opposite card is a different color", category: "opponent", description: "Color contrast bonus", example: "+3 if opposite card is a different color" },
  { label: "If opposite is [Color]", template: "+{points} if opposite card is {color}", category: "opponent", description: "Bonus vs specific color", example: "+5 if opposite card is RED" },
  { label: "If opposite is active", template: "+{points} if opposite card's effect is active", category: "opponent", description: "Punish opponent's triggered abilities", example: "+3 if opposite card's effect is active" },
  { label: "If opposite is inactive", template: "+{points} if opposite card has no active effect", category: "opponent", description: "Bonus vs vanilla/failed effect cards", example: "+4 if opposite card has no active effect" },
  { label: "If opposite is canceling", template: "+{points} if opposite card has a cancel effect", category: "opponent", description: "Anti-cancel bonus", example: "+6 if opposite card has a cancel effect" },
  { label: "If opposite is [Type]", template: "+{points} if opposite card is a {type}", category: "opponent", description: "Bonus vs specific type", example: "+4 if opposite card is a VILLAIN" },
  { label: "If opponent plays [Type]", template: "+{points} if opponent has any {type} in play", category: "opponent", description: "Triggers when opponent uses type", example: "+3 if opponent has any HERO in play" },
  { label: "If opponent plays [Color]", template: "+{points} if opponent has any {color} card in play", category: "opponent", description: "Triggers when opponent uses color", example: "+2 if opponent has any BLUE card in play" },
  { label: "Cancel if opposite is [Type]", template: "Cancel opposite card if it is a {type}", category: "opponent", description: "Type-specific cancel", example: "Cancel opposite card if it is a DROID" },
  
  // === DECK AND HAND CONDITIONS ===
  { label: "If deck has 3+ [Type]", template: "+{points} if your deck has 3 or more {type} cards", category: "deck", description: "Synergy bonus for type-focused decks", example: "+5 if your deck has 3 or more HERO cards" },
  { label: "If deck has 4+ [Color]", template: "+{points} if your deck has 4 or more {color} cards", category: "deck", description: "Synergy bonus for color-focused decks", example: "+4 if your deck has 4 or more BLUE cards" },
  { label: "If played after [Type]", template: "+{points} if played after a {type}", category: "deck", description: "Combo bonus for sequencing", example: "+4 if played after a VILLAIN" },
  { label: "If this is unique type", template: "+{points} if this is the only {type} in your deck", category: "deck", description: "Unique typing bonus", example: "+6 if this is the only PRINCESS in your deck" },
  { label: "If prior card was [Type]", template: "+{points} if your prior played card was a {type}", category: "deck", description: "Sequential type combo", example: "+3 if your prior played card was a JEDI" },
  { label: "If prior card higher base", template: "+{points} if your prior played card had higher base points", category: "deck", description: "Descending power chain", example: "+2 if your prior played card had higher base points" },
  { label: "If prior card lower base", template: "+{points} if your prior played card had lower base points", category: "deck", description: "Ascending power chain", example: "+3 if your prior played card had lower base points" },
  { label: "If no [Type] played yet", template: "+{points} if you haven't played a {type} yet", category: "deck", description: "First of type bonus", example: "+5 if you haven't played a HERO yet" },
  
  // === SLAM/RARITY CONDITIONS ===
  { label: "If opposite is Slam", template: "+{points} if opposite card is a Slam rarity", category: "slam", description: "Anti-Slam bonus for common cards", example: "+10 if opposite card is a Slam rarity" },
  { label: "x2 if opposite is Slam", template: "x2 if opposite card is a Slam rarity", category: "slam", description: "Double vs Slam cards", example: "Doubles when facing a Slam card" },
  { label: "Cancel if opposite is Slam", template: "Cancel opposite card if it is a Slam rarity", category: "slam", description: "Slam-specific cancel", example: "Nullify opponent's Slam card" },
  { label: "If opponent has Slam in play", template: "+{points} if opponent has any Slam card in play", category: "slam", description: "Triggers when opponent uses Slam", example: "+5 if opponent has any Slam card in play" },
  { label: "If no Slams in play", template: "+{points} if no Slam cards are in play", category: "slam", description: "Bonus when no rare cards present", example: "+4 if no Slam cards are in play" },
  
  // === CHARACTER/CARD CONDITIONS ===
  { label: "If [Card] in play, set type", template: "If {cardName} is in play, this card becomes a {type}", category: "transform", description: "Conditional type transformation", example: "If Batman is in play, this card becomes a HERO" },
  { label: "If [Card] in play, gain effect", template: "If {cardName} is in play, +{points} to all {type}", category: "transform", description: "Unlock ability when specific card present", example: "If Robin is in play, +2 to all TEEN TITANS members" },
  { label: "Become [Type] if adjacent to [Type]", template: "Become a {type} if adjacent to a {type2}", category: "transform", description: "Adjacency-based transformation", example: "Become a HERO if adjacent to a VILLAIN" },
  
  // === SWAP/SWITCH EFFECTS (EXPANDED) ===
  { label: "Switch with opposite gtoon", template: "Switch positions with opposite card", category: "swap", description: "Swap your card with the opposing card's position", example: "Your card goes to opponent's board and vice versa" },
  { label: "Swap opposite with opponent deck", template: "Swap opposite card with a random card from opponent's deck", category: "swap", description: "Replace opponent's played card with unknown deck card", example: "Opponent's card is replaced by random deck card" },
  { label: "Swap neighbor with opposite", template: "Swap a neighboring card with the opposite card", category: "swap", description: "Force a neighbor to face opponent's card", example: "Move your neighbor to face the opposite card" },
  
  // === TYPE/COLOR TRANSFORMATION ===
  { label: "Change all yours to [Type]", template: "Change all your cards to {type}", category: "transform", description: "Mass type change for your board", example: "Change all your cards to HERO" },
  { label: "Change all opponent to [Type]", template: "Change all opponent's cards to {type}", category: "transform", description: "Mass type change for opponent", example: "Change all opponent's cards to VILLAIN" },
  { label: "Change neighbors to [Type]", template: "Change neighboring cards to {type}", category: "transform", description: "Adjacent type transformation", example: "Change neighboring cards to CLONE" },
  { label: "Change all yours to [Color]", template: "Change all your cards to {color}", category: "transform", description: "Mass color change for your board", example: "Change all your cards to BLUE" },
  { label: "Change all opponent to [Color]", template: "Change all opponent's cards to {color}", category: "transform", description: "Mass color change for opponent", example: "Change all opponent's cards to RED" },
  { label: "Change neighbors to [Color]", template: "Change neighboring cards to {color}", category: "transform", description: "Adjacent color transformation", example: "Change neighboring cards to GREEN" },
  { label: "Change opposite to [Type]", template: "Change opposite card to {type}", category: "transform", description: "Single target type change", example: "Change opposite card to MONSTER" },
  { label: "Change opposite to [Color]", template: "Change opposite card to {color}", category: "transform", description: "Single target color change", example: "Change opposite card to PURPLE" },
  
  // === DUAL/CHOICE ABILITIES ===
  { label: "Choose: +X or +Y per [Type]", template: "Choose one: +{points} or +{points2} for each {type} in play", category: "choice", description: "Player picks between two bonuses", example: "Choose one: +7 or +2 for each HERO in play" },
  { label: "Choose: buff self or debuff opposite", template: "Choose one: +{points} to this card or -{points} to opposite card", category: "choice", description: "Offensive or defensive choice", example: "Choose one: +5 to this card or -5 to opposite card" },
  { label: "Choose: cancel or double", template: "Choose one: cancel opposite card or double this card's points", category: "choice", description: "Control or power choice", example: "Pick between canceling opponent or doubling yourself" },
  { label: "Choose: buff neighbors or all [Type]", template: "Choose one: +{points} to neighbors or +{points2} to all {type}", category: "choice", description: "Local vs global buff choice", example: "Choose: +4 to neighbors or +2 to all VILLAINS" },
  { label: "Activate one of two effects", template: "Activate one: {effect1} OR {effect2}", category: "choice", description: "Generic dual ability template", example: "Activate one: +8 OR x2 to neighboring HERO" },
  
  // === COLOR MATCHING CONDITIONS ===
  { label: "If same color as neighbor", template: "+{points} if same color as a neighboring card", category: "color", description: "Color synergy with adjacents", example: "+3 if same color as a neighboring card" },
  { label: "If different color from neighbor", template: "+{points} if different color from all neighboring cards", category: "color", description: "Color diversity bonus", example: "+4 if different color from all neighboring cards" },
  { label: "If matches round color", template: "+{points} if this card matches the round's winning color", category: "color", description: "Bonus for matching color condition", example: "+5 if this card matches the round's winning color" },
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
  const [effectSearch, setEffectSearch] = useState("");

  // Filter power patterns based on search
  const filteredPatterns = useMemo(() => {
    if (!effectSearch.trim()) return POWER_PATTERNS;
    const search = effectSearch.toLowerCase();
    return POWER_PATTERNS.filter(
      (p) =>
        p.label.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.example.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search)
    );
  }, [effectSearch]);

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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-medium">Quick patterns (click to apply):</p>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      placeholder="Search effects..."
                      value={effectSearch}
                      onChange={(e) => setEffectSearch(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                  {effectSearch && (
                    <span className="text-xs text-muted-foreground">
                      {filteredPatterns.length} results
                    </span>
                  )}
                </div>
                
                <TooltipProvider delayDuration={200}>
                  {/* Search Results Mode */}
                  {effectSearch ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Search Results</p>
                      <div className="flex flex-wrap gap-1">
                        {filteredPatterns.map((pattern) => (
                          <Tooltip key={pattern.label}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => applyPowerPattern(pattern.template)}
                              >
                                {pattern.label}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="font-medium">{pattern.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {filteredPatterns.length === 0 && (
                          <p className="text-xs text-muted-foreground">No effects found matching "{effectSearch}"</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Conditional Bonuses */}
                      <div className="space-y-1">
                        <p className="text-xs text-primary">Conditional (+X if...)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "conditional").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Multipliers */}
                      <div className="space-y-1">
                        <p className="text-xs text-orange-400">Multipliers (x2, x3...)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "multiplier").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Counting */}
                      <div className="space-y-1">
                        <p className="text-xs text-yellow-400">Count-Based (+X for each...)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "counting").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Buffs */}
                      <div className="space-y-1">
                        <p className="text-xs text-green-400">Buff Others (+X to...)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "buff").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Debuffs */}
                      <div className="space-y-1">
                        <p className="text-xs text-red-400">Debuff Opponents (-X to...)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "debuff").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Special */}
                      <div className="space-y-1">
                        <p className="text-xs text-purple-400">Special / Complex</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "special" || p.category === "basic").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Defensive */}
                      <div className="space-y-1">
                        <p className="text-xs text-cyan-400">🛡️ Defensive (Shield, Immunity)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "defensive").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Steal */}
                      <div className="space-y-1">
                        <p className="text-xs text-rose-400">💀 Steal Effects</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "steal").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Swap/Copy */}
                      <div className="space-y-1">
                        <p className="text-xs text-indigo-400">🔄 Swap / Copy / Mirror</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "swap").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Position */}
                      <div className="space-y-1">
                        <p className="text-xs text-teal-400">📍 Position-Based</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "position").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Underdog */}
                      <div className="space-y-1">
                        <p className="text-xs text-amber-400">🔥 Underdog / Comeback</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "underdog").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Random */}
                      <div className="space-y-1">
                        <p className="text-xs text-emerald-400">🎲 Random / Gamble</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "random").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Gambling - Coin Flip & Dice Roll */}
                      <div className="space-y-1">
                        <p className="text-xs text-yellow-500">🎰 Gambling (Coin Flip & Dice Roll)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "gamble").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-yellow-500/30 hover:bg-yellow-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Chain/Combo */}
                      <div className="space-y-1">
                        <p className="text-xs text-fuchsia-400">⚡ Chain / Combo Effects</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "chain").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Color Manipulation */}
                      <div className="space-y-1">
                        <p className="text-xs text-pink-400">🎨 Color Manipulation</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "color").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-pink-500/30 hover:bg-pink-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Resource Effects */}
                      <div className="space-y-1">
                        <p className="text-xs text-lime-400">📦 Resource / Hand Effects</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "resource").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-lime-500/30 hover:bg-lime-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Amplify Effects */}
                      <div className="space-y-1">
                        <p className="text-xs text-sky-400">🔊 Amplify / Double Effects</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "amplify").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-sky-500/30 hover:bg-sky-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Match-Based Conditions */}
                      <div className="space-y-1">
                        <p className="text-xs text-blue-400">⚔️ Match-Based Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "match").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-blue-500/30 hover:bg-blue-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Opponent-Dependent Conditions */}
                      <div className="space-y-1">
                        <p className="text-xs text-red-500">👁️ Opponent-Dependent</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "opponent").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-red-500/30 hover:bg-red-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Deck/Hand Conditions */}
                      <div className="space-y-1">
                        <p className="text-xs text-violet-400">🃏 Deck & Hand Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "deck").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-violet-500/30 hover:bg-violet-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Slam/Rarity Conditions */}
                      <div className="space-y-1">
                        <p className="text-xs text-gradient from-pink-500 to-orange-500 bg-gradient-to-r bg-clip-text text-transparent">⭐ Slam / Rarity Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "slam").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-pink-500/30 hover:bg-pink-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Transform Effects */}
                      <div className="space-y-1">
                        <p className="text-xs text-orange-400">🔮 Transform (Type/Color Change)</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "transform").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-orange-500/30 hover:bg-orange-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      
                      {/* Choice/Dual Abilities */}
                      <div className="space-y-1">
                        <p className="text-xs text-cyan-500">🎯 Choice / Dual Abilities</p>
                        <div className="flex flex-wrap gap-1">
                          {POWER_PATTERNS.filter(p => p.category === "choice").map((pattern) => (
                            <Tooltip key={pattern.label}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 border-cyan-500/30 hover:bg-cyan-500/10"
                                  onClick={() => applyPowerPattern(pattern.template)}
                                >
                                  {pattern.label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="font-medium">{pattern.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Example: {pattern.example}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TooltipProvider>
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
