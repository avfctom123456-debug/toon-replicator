import cardsData from "@/data/cards.json";
import { seededCoinFlip, seededDiceRoll, getSeededGamblingRandom } from "@/lib/seededRandom";

export interface GameCard {
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

export interface PlacedCard {
  card: GameCard;
  cancelled: boolean;
  modifiedPoints: number;
  position: number;
  shielded?: boolean; // Immune to cancellation and negative effects
  stolenPoints?: number; // Points stolen from this card
  countsAsAllColors?: boolean; // This card counts as all colors for color condition
  convertedColors?: string[]; // Colors this card has been converted to
  convertedTypes?: string[]; // Types this card has been converted to
  swappedPosition?: number; // Original position if swapped
  playOrder?: number; // Order this card was played (1-7)
  priorCardId?: number; // ID of the card played before this one
  choiceResolved?: boolean; // Whether a choice effect has been resolved
  chosenEffect?: string; // The effect chosen by the player
  gamblingResult?: 'win' | 'lose' | 'pending'; // Result of coin flip/dice roll
}

export interface PlayerState {
  deck: GameCard[];
  hand: GameCard[];
  board: (PlacedCard | null)[];
  bottomCard: GameCard | null;
  totalPoints: number;
  colorCounts: Record<string, number>;
}

export interface GameState {
  phase: "deck-select" | "round1-place" | "round1-reveal" | "round1-discard" | "round2-place" | "round2-reveal" | "round2-swap" | "round2-final" | "game-over";
  player: PlayerState;
  opponent: PlayerState;
  mainColors: string[];
  winner: "player" | "opponent" | "tie" | null;
  winMethod: "color" | "points" | null;
  round2FlipIndex: number;
  // Global effect modifiers
  overrideMainColors?: string[]; // Changed by "Change color condition" effects
  reverseScoring?: boolean; // If true, lowest total wins
  // Match tracking for effects
  round1PlayerScore?: number; // Player's score at end of round 1
  round1OpponentScore?: number; // Opponent's score at end of round 1
  playOrderCounter?: number; // Counter for tracking play order
  pendingChoiceEffects?: PendingChoiceEffect[]; // Choice effects waiting for resolution
}

export interface PendingChoiceEffect {
  cardPosition: number;
  isPlayer: boolean;
  effectType: string;
  options: { label: string; value: string }[];
}

const allCards = cardsData as GameCard[];

export function getCardById(id: number): GameCard | undefined {
  return allCards.find(c => c.id === id);
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createPlayerState(deckCardIds: number[]): PlayerState {
  const deck = shuffleArray(
    deckCardIds
      .map(id => getCardById(id))
      .filter((c): c is GameCard => c !== undefined)
  );
  
  const bottomCard = deck[deck.length - 1] || null;
  const hand = deck.slice(0, 6);
  
  return {
    deck,
    hand,
    board: Array(7).fill(null),
    bottomCard,
    totalPoints: 0,
    colorCounts: {},
  };
}

export function getMainColors(player: PlayerState, opponent: PlayerState): string[] {
  const colors: string[] = [];
  
  const addColor = (card: GameCard | null) => {
    if (!card) return;
    for (const color of card.colors) {
      if (color !== "SILVER" && color !== "BLACK" && !colors.includes(color)) {
        colors.push(color);
      }
    }
  };
  
  addColor(player.bottomCard);
  addColor(opponent.bottomCard);
  
  return colors;
}

export function createAIDeck(): number[] {
  const shuffled = shuffleArray(allCards);
  return shuffled.slice(0, 12).map(c => c.id);
}

export function initializeGame(playerDeckIds: number[]): GameState {
  const player = createPlayerState(playerDeckIds);
  const opponent = createPlayerState(createAIDeck());
  const mainColors = getMainColors(player, opponent);
  
  return {
    phase: "round1-place",
    player,
    opponent,
    mainColors,
    winner: null,
    winMethod: null,
    round2FlipIndex: 0,
  };
}

export function aiPlaceCards(state: GameState, count: number, startIndex: number): GameState {
  const newState = { ...state };
  const opponentHand = [...state.opponent.hand];
  const opponentBoard = [...state.opponent.board];
  
  const sortedHand = [...opponentHand].sort((a, b) => {
    const aHasMainColor = a.colors.some(c => state.mainColors.includes(c));
    const bHasMainColor = b.colors.some(c => state.mainColors.includes(c));
    if (aHasMainColor && !bHasMainColor) return -1;
    if (bHasMainColor && !aHasMainColor) return 1;
    return b.points - a.points;
  });
  
  const usedCharacters = new Set<string>();
  opponentBoard.forEach(slot => {
    if (slot?.card) usedCharacters.add(slot.card.character);
  });
  
  let placed = 0;
  for (const card of sortedHand) {
    if (placed >= count) break;
    if (usedCharacters.has(card.character)) continue;
    
    const slotIndex = startIndex + placed;
    opponentBoard[slotIndex] = {
      card,
      cancelled: false,
      modifiedPoints: card.points,
      position: slotIndex,
    };
    usedCharacters.add(card.character);
    placed++;
  }
  
  const placedCards = opponentBoard
    .slice(startIndex, startIndex + count)
    .filter((s): s is PlacedCard => s !== null)
    .map(s => s.card.id);
  
  newState.opponent = {
    ...state.opponent,
    board: opponentBoard,
    hand: opponentHand.filter(c => !placedCards.includes(c.id)),
  };
  
  return newState;
}

export function checkCancellations(state: GameState): GameState {
  const newState = { ...state };
  const playerBoard = [...state.player.board];
  const opponentBoard = [...state.opponent.board];
  
  // First, mark shielded cards (cannot be cancelled)
  const markShielded = (board: (PlacedCard | null)[]) => {
    board.forEach((slot, i) => {
      if (slot) {
        const desc = slot.card.description.toLowerCase();
        if (desc.includes("cannot be cancelled") || desc.includes("immune to cancellation") || desc.includes("shielded")) {
          board[i] = { ...slot, shielded: true };
        }
      }
    });
  };
  
  markShielded(playerBoard);
  markShielded(opponentBoard);
  
  const playerCharacters: Record<string, number[]> = {};
  const opponentCharacters: Record<string, number[]> = {};
  
  playerBoard.forEach((slot, i) => {
    if (slot && !slot.cancelled) {
      if (!playerCharacters[slot.card.character]) {
        playerCharacters[slot.card.character] = [];
      }
      playerCharacters[slot.card.character].push(i);
    }
  });
  
  opponentBoard.forEach((slot, i) => {
    if (slot && !slot.cancelled) {
      if (!opponentCharacters[slot.card.character]) {
        opponentCharacters[slot.card.character] = [];
      }
      opponentCharacters[slot.card.character].push(i);
    }
  });
  
  for (const char in playerCharacters) {
    if (playerCharacters[char].length > 1) {
      playerCharacters[char].forEach(i => {
        if (playerBoard[i] && !playerBoard[i]!.shielded) {
          playerBoard[i] = { ...playerBoard[i]!, cancelled: true };
        }
      });
    }
  }
  
  for (const char in opponentCharacters) {
    if (opponentCharacters[char].length > 1) {
      opponentCharacters[char].forEach(i => {
        if (opponentBoard[i] && !opponentBoard[i]!.shielded) {
          opponentBoard[i] = { ...opponentBoard[i]!, cancelled: true };
        }
      });
    }
  }
  
  for (const char in playerCharacters) {
    if (opponentCharacters[char]) {
      playerCharacters[char].forEach(i => {
        if (playerBoard[i] && !playerBoard[i]!.shielded) {
          playerBoard[i] = { ...playerBoard[i]!, cancelled: true };
        }
      });
      opponentCharacters[char].forEach(i => {
        if (opponentBoard[i] && !opponentBoard[i]!.shielded) {
          opponentBoard[i] = { ...opponentBoard[i]!, cancelled: true };
        }
      });
    }
  }
  
  newState.player = { ...state.player, board: playerBoard };
  newState.opponent = { ...state.opponent, board: opponentBoard };
  
  return newState;
}

// Board layout:
// [0] [1] [2] [3]   <- Round 1
//   [4] [5] [6]     <- Round 2 (offset/centered below)
function getNeighborIndices(position: number): number[] {
  const neighborMap: Record<number, number[]> = {
    0: [1, 4],           // right, diagonal down-right
    1: [0, 2, 4, 5],     // left, right, diagonal down-left, diagonal down-right
    2: [1, 3, 5, 6],     // left, right, diagonal down-left, diagonal down-right
    3: [2, 6],           // left, diagonal down-left
    4: [5, 0, 1],        // right, diagonal up-left, diagonal up-right
    5: [4, 6, 1, 2],     // left, right, diagonal up-left, diagonal up-right
    6: [5, 2, 3],        // left, diagonal up-left, diagonal up-right
  };
  return neighborMap[position] || [];
}

function getOppositeIndex(position: number): number {
  return position; // Same index on opponent's board
}

// Parse multi-target strings like "Dexter, Dee Dee, Dexter's Mom, or Dexter's Dad" or "Ed, Edd, and Eddy"
function parseMultiTargets(targetStr: string): string[] {
  // Split by comma, "or", or "and" and clean up
  const parts = targetStr.split(/,\s*|\s+or\s+|\s+and\s+/).map(t => t.trim()).filter(t => t);
  return parts.length > 0 ? parts : [targetStr];
}

function matchesSingleTarget(card: GameCard, target: string): boolean {
  let lowerTarget = target.toLowerCase().trim();
  
  // Remove "gtoon", "gtoons", "toon", "toons" suffixes as they're generic terms for any card
  lowerTarget = lowerTarget.replace(/\s*(gtoons?|toons?)\s*$/i, '').trim();
  
  // Handle "member of [Group]" pattern - extract the group name
  const memberMatch = lowerTarget.match(/member\s+of\s+(.+)/);
  if (memberMatch) {
    lowerTarget = memberMatch[1].trim();
  }
  
  // Also handle "[Group] member" pattern
  lowerTarget = lowerTarget.replace(/\s+member$/i, '').trim();
  
  // If after cleaning the target is empty, it doesn't match anything specific
  if (!lowerTarget) return false;
  
  // Handle compound types like "Male Villains", "Female Heroes"
  // Check if target contains multiple type words that should all match
  const compoundTypeMatch = lowerTarget.match(/^(male|female)\s+(hero|villain|animal|monster|prop|vehicle|criminal)s?$/i);
  if (compoundTypeMatch) {
    const gender = compoundTypeMatch[1].toUpperCase();
    const type = compoundTypeMatch[2].toUpperCase();
    // Card must have both types
    return card.types.includes(gender) && card.types.includes(type);
  }
  
  // Check character name
  if (card.character.toLowerCase().includes(lowerTarget)) return true;
  
  // Check title
  if (card.title.toLowerCase().includes(lowerTarget)) return true;
  
  // Check types (uppercase in data)
  const upperTarget = lowerTarget.toUpperCase().trim();
  if (card.types.includes(upperTarget)) return true;
  if (card.types.some(t => t.toLowerCase() === lowerTarget)) return true;
  
  // Check groups
  if (card.groups.some(g => g.toLowerCase().includes(lowerTarget))) return true;
  
  // Common type aliases
  const typeMap: Record<string, string> = {
    "hero": "HERO",
    "villain": "VILLAIN", 
    "animal": "ANIMAL",
    "female": "FEMALE",
    "male": "MALE",
    "monster": "MONSTER",
    "prop": "PROP",
    "vehicle": "VEHICLE",
    "princess": "PRINCESS",
    "prince": "PRINCE",
    "king": "KING",
    "queen": "QUEEN",
    "noble": "NOBLE",
    "elemental": "ELEMENTAL",
    "spirit": "SPIRIT",
    "jedi": "JEDI",
    "sith": "SITH",
    "clone": "CLONE",
    "droid": "DROID",
    "saiyan": "SAIYAN",
    "namekian": "NAMEKIAN",
    "minion": "MINION",
    "criminal": "CRIMINAL",
    "politician": "POLITICIAN",
    "lawyer": "LAWYER",
    "consort": "CONSORT",
    "glitch": "GLITCH",
    "cameo": "CAMEO",
    "place": "PLACE",
    "fairy tale character": "FAIRY TALE CHARACTER",
    "avatar": "AVATAR",
    "gaang": "GAANG",
  };
  
  if (typeMap[lowerTarget] && card.types.includes(typeMap[lowerTarget])) return true;
  
  // Check for group membership
  const groupMap: Record<string, string> = {
    "justice league": "JUSTICE LEAGUE",
    "teen titan": "TEEN TITANS",
    "powerpuff": "POWERPUFF GIRLS",
    "powerpuff girls": "POWERPUFF GIRLS",
    "clone wars": "CLONE WARS",
    "dragon ball": "DRAGON BALL Z",
    "dragon ball z": "DRAGON BALL Z",
    "dbz": "DRAGON BALL Z",
    "kung fu panda": "KUNG FU PANDA",
    "kung fu": "KUNG FU PANDA",
    "despicable me": "DESPICABLE ME",
    "despicable": "DESPICABLE ME",
    "frozen": "FROZEN",
    "avatar": "AVATAR",
    "spongebob": "SPONGEBOB",
    "shrek": "SHREK",
    "cars": "CARS",
    "phineas": "PHINEAS FERB",
    "wreck-it ralph": "WRECK-IT RALPH",
    "wreck it ralph": "WRECK-IT RALPH",
    "zootopia": "ZOOTOPIA",
    "ed, edd 'n eddy": "ED EDD N EDDY",
    "ed edd n eddy": "ED EDD N EDDY",
    "ed, edd n eddy": "ED EDD N EDDY",
    "mystery, inc": "MYSTERY, INC.",
    "mystery inc": "MYSTERY, INC.",
    "injustice gang": "INJUSTICE GANG",
    "imaginary friend": "IMAGINARY FRIEND",
    "bean scouts": "BEAN SCOUTS",
    "mucha lucha": "MUCHA LUCHA",
    "looney tunes": "LOONEY TUNES",
  };
  
  for (const [key, group] of Object.entries(groupMap)) {
    if (lowerTarget.includes(key) && card.groups.includes(group)) return true;
  }
  
  return false;
}

function matchesTarget(card: GameCard, target: string): boolean {
  // Check if target contains multiple targets separated by comma or "or"
  if (target.includes(',') || target.toLowerCase().includes(' or ')) {
    const targets = parseMultiTargets(target);
    return targets.some(t => matchesSingleTarget(card, t));
  }
  return matchesSingleTarget(card, target);
}

function hasColor(card: GameCard, color: string): boolean {
  return card.colors.includes(color.toUpperCase());
}

export function applyPowers(state: GameState): GameState {
  const playerBoard = state.player.board.map((s, i) => s ? { ...s, position: i, modifiedPoints: s.card.basePoints } : null);
  const opponentBoard = state.opponent.board.map((s, i) => s ? { ...s, position: i, modifiedPoints: s.card.basePoints } : null);
  
  const allPlayerCards = playerBoard.filter((s): s is PlacedCard => s !== null && !s.cancelled);
  const allOpponentCards = opponentBoard.filter((s): s is PlacedCard => s !== null && !s.cancelled);
  const allActiveCards = [...allPlayerCards, ...allOpponentCards];
  
  // Check if a position is in round 2 (slots 4, 5, 6)
  const isRound2Position = (pos: number) => pos >= 4 && pos <= 6;
  
  // Process each card's powers
  const processCardPower = (
    slot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = slot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const neighbors = getNeighborIndices(slot.position);
    const oppositeIdx = getOppositeIndex(slot.position);
    const oppositeCard = enemyBoard[oppositeIdx];
    
    // Parse multiple effects (split by semicolon)
    const effects = desc.split(';').map(e => e.trim());
    
    for (const effect of effects) {
      // "+X if played in the 2nd round" or "+X if played in 2nd round"
      let match = effect.match(/\+(\d+)\s+if\s+played\s+in\s+(?:the\s+)?2nd\s+round/);
      if (match) {
        const bonus = parseInt(match[1]);
        if (isRound2Position(slot.position)) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X if played first in the first round"
      match = effect.match(/\+(\d+)\s+if\s+played\s+first\s+in\s+(?:the\s+)?first\s+round/);
      if (match) {
        const bonus = parseInt(match[1]);
        if (slot.position === 0) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X if played as the last card" - Mystico
      match = effect.match(/\+(\d+)\s+if\s+played\s+as\s+the\s+last\s+card/);
      if (match) {
        const bonus = parseInt(match[1]);
        // Last card is position 6 (last slot of round 2)
        if (slot.position === 6) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // === NEW POSITION-BASED EFFECTS ===
      
      // "+X if placed in corner" (slots 0 or 3 in round 1)
      match = effect.match(/\+(\d+)\s+if\s+(?:placed\s+)?in\s+corner/);
      if (match) {
        const bonus = parseInt(match[1]);
        if (slot.position === 0 || slot.position === 3) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X if placed in center" (slot 5 in round 2)
      match = effect.match(/\+(\d+)\s+if\s+(?:placed\s+)?in\s+center/);
      if (match) {
        const bonus = parseInt(match[1]);
        if (slot.position === 5) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X for each adjacent filled slot" (Anchor effect)
      match = effect.match(/\+(\d+)\s+for\s+each\s+adjacent\s+filled\s+slot/);
      if (match) {
        const bonus = parseInt(match[1]);
        const neighborCount = neighbors.filter(idx => ownBoard[idx] && !ownBoard[idx]!.cancelled).length;
        slot.modifiedPoints += bonus * neighborCount;
        continue;
      }
      
      // "Randomly gain +X to +Y points" (Gamble effect)
      match = effect.match(/randomly\s+gain\s+\+(\d+)\s+to\s+\+(\d+)/);
      if (match) {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        const randomBonus = Math.floor(Math.random() * (max - min + 1)) + min;
        slot.modifiedPoints += randomBonus;
        continue;
      }
      
      // "Copy base points of [type]" or "Copy the base points of another [type]"
      match = effect.match(/copy\s+(?:the\s+)?base\s+points\s+of\s+(?:another\s+)?(.+)/);
      if (match) {
        const target = match[1];
        const matchingCard = allActiveCards.find(c => c.card.id !== slot.card.id && matchesTarget(c.card, target));
        if (matchingCard) {
          slot.modifiedPoints = matchingCard.card.basePoints;
        }
        continue;
      }
      
      // "x2 if this is your only non-cancelled card" (Last Stand)
      match = effect.match(/x2\s+if\s+(?:this\s+is\s+)?(?:your\s+)?only\s+non-cancelled/);
      if (match) {
        const ownActiveCards = ownBoard.filter(s => s && !s.cancelled);
        if (ownActiveCards.length === 1 && ownActiveCards[0]?.card.id === slot.card.id) {
          slot.modifiedPoints *= 2;
        }
        continue;
      }
      
      // "+X if any [character] is in play"
      match = effect.match(/\+(\d+)\s+if\s+(?:any\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "-X if any [character] is in play" - negative conditional
      match = effect.match(/-(\d+)\s+if\s+(?:any\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints -= penalty;
        }
        continue;
      }
      
      // "+X if next to any [target]"
      match = effect.match(/\+(\d+)\s+if\s+next\s+to\s+(?:any\s+)?(.+)/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const hasNeighbor = neighbors.some(idx => {
          const neighbor = ownBoard[idx];
          return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target);
        });
        if (hasNeighbor) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X if adjacent to a [target]" or "+X if adjacent to [target]"
      match = effect.match(/\+(\d+)\s+if\s+adjacent\s+to\s+(?:a\s+)?(.+)/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const hasNeighbor = neighbors.some(idx => {
          const neighbor = ownBoard[idx];
          return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target);
        });
        if (hasNeighbor) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "x2 if next to any [target]" or "x2 if next to [target]"
      match = effect.match(/x2\s+if\s+next\s+to\s+(?:any\s+)?(.+)/);
      if (match) {
        const target = match[1];
        const hasNeighbor = neighbors.some(idx => {
          const neighbor = ownBoard[idx];
          return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target);
        });
        if (hasNeighbor) {
          slot.modifiedPoints *= 2;
        }
        continue;
      }
      
      // "x2 if [character] is in play" or "x3 if [character] is in play"
      match = effect.match(/x(\d)\s+if\s+(?:the\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const multiplier = parseInt(match[1]);
        const target = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints *= multiplier;
        }
        continue;
      }
      
      // "x2 if [A] or [B] is in play" - Sam
      match = effect.match(/x(\d)\s+if\s+(.+?)\s+or\s+(.+?)\s+is\s+in\s+play/);
      if (match) {
        const multiplier = parseInt(match[1]);
        const target1 = match[2].trim();
        const target2 = match[3].trim();
        if (allActiveCards.some(c => matchesTarget(c.card, target1) || matchesTarget(c.card, target2))) {
          slot.modifiedPoints *= multiplier;
        }
        continue;
      }
      
      // "+X if [A] and [B] are both in play" - The Infraggable Krunk
      match = effect.match(/\+(\d+)\s+if\s+(.+?)\s+and\s+(.+?)\s+are\s+both\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target1 = match[2].trim();
        const target2 = match[3].trim();
        const hasTarget1 = allActiveCards.some(c => matchesTarget(c.card, target1));
        const hasTarget2 = allActiveCards.some(c => matchesTarget(c.card, target2));
        if (hasTarget1 && hasTarget2) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "x3 if next to any [target]" or "x3 if next to [target]"
      match = effect.match(/x3\s+if\s+next\s+to\s+(?:any\s+|another\s+)?(.+)/);
      if (match) {
        const target = match[1];
        const hasNeighbor = neighbors.some(idx => {
          const neighbor = ownBoard[idx];
          return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target);
        });
        if (hasNeighbor) {
          slot.modifiedPoints *= 3;
        }
        continue;
      }
      
      // "xN if opposite card is [color/type]" - Coco, Eduardo
      match = effect.match(/x(\d)\s+if\s+opposite\s+card\s+is\s+(.+)/);
      if (match && oppositeCard && !oppositeCard.cancelled) {
        const multiplier = parseInt(match[1]);
        const target = match[2].trim();
        if (hasColor(oppositeCard.card, target) || matchesTarget(oppositeCard.card, target)) {
          slot.modifiedPoints *= multiplier;
        }
        continue;
      }
      
      // "+X for each other [type] in play" - excludes self
      match = effect.match(/\+(\d+)\s+for\s+each\s+other\s+(.+?)(?:\s+in\s+play)?$/);
      if (match && !effect.includes("neighboring")) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const count = allActiveCards.filter(c => c.card.id !== slot.card.id && (matchesTarget(c.card, target) || hasColor(c.card, target))).length;
        slot.modifiedPoints += bonus * count;
        continue;
      }
      
      // "+X if any other [type] is in play" - excludes self
      match = effect.match(/\+(\d+)\s+if\s+(?:any\s+)?other\s+(.+?)\s+is\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const hasOther = allActiveCards.some(c => c.card.id !== slot.card.id && matchesTarget(c.card, target));
        if (hasOther) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X for each [type] in play" or "+X for each [target]"
      match = effect.match(/\+(\d+)\s+for\s+each\s+(?:opponent\s+)?(.+?)(?:\s+in\s+play)?$/);
      if (match && !effect.includes("neighboring") && !effect.includes("other")) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const isOpponentOnly = effect.includes("opponent");
        const searchCards = isOpponentOnly ? allOpponentCards : allActiveCards;
        const count = searchCards.filter(c => matchesTarget(c.card, target) || hasColor(c.card, target)).length;
        slot.modifiedPoints += bonus * count;
        continue;
      }
      
      // "+X for each neighboring [target]" or "+X for each neighboring [target1] and [target2]"
      match = effect.match(/\+(\d+)\s+for\s+each\s+neighboring\s+(.+)/);
      if (match) {
        const bonus = parseInt(match[1]);
        const targetStr = match[2];
        // Handle "X and Y" targets
        const targets = targetStr.split(/\s+and\s+/).map(t => t.trim());
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled) {
            if (targets.some(t => matchesTarget(neighbor.card, t))) {
              slot.modifiedPoints += bonus;
            }
          }
        });
        continue;
      }
      
      // "-X for each [type]" or "-X for each opponent [type]"
      match = effect.match(/-(\d+)\s+for\s+each\s+(?:opponent\s+)?(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        const isOpponentOnly = effect.includes("opponent");
        const searchCards = isOpponentOnly ? allOpponentCards : allActiveCards;
        const count = searchCards.filter(c => matchesTarget(c.card, target) || hasColor(c.card, target)).length;
        slot.modifiedPoints -= penalty * count;
        continue;
      }
      
      // "+X for each [type] opponent" - La Flamencita (type before "opponent")
      match = effect.match(/\+(\d+)\s+for\s+each\s+(.+?)\s+opponent/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const count = allOpponentCards.filter(c => matchesTarget(c.card, target)).length;
        slot.modifiedPoints += bonus * count;
        continue;
      }
      
      // "+X to all [color] cards" - buffs other cards (handled in second pass)
      // "-X to [target]" - debuffs (handled in second pass)
      // "+X to [character]" - buffs specific cards (handled in second pass)
    }
  };
  
  // First pass: calculate self-modifying powers
  allPlayerCards.forEach(slot => processCardPower(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => processCardPower(slot, opponentBoard, playerBoard, false));
  
  // Second pass: apply powers that affect other cards
  const applyBuffsDebuffs = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const effects = desc.split(';').map(e => e.trim());
    const neighbors = getNeighborIndices(sourceSlot.position);
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    
    for (const effect of effects) {
      // "x2 to each neighboring [type]"
      let match = effect.match(/x2\s+to\s+each\s+neighboring\s+(.+)/);
      if (match) {
        const target = match[1];
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target)) {
            neighbor.modifiedPoints *= 2;
          }
        });
        continue;
      }
      
      // "x2 to any neighboring [target]" or "x2 to neighboring [target]"
      match = effect.match(/x2\s+to\s+(?:any\s+)?neighboring\s+(.+)/);
      if (match) {
        const target = match[1];
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target)) {
            neighbor.modifiedPoints *= 2;
          }
        });
        continue;
      }
      
      // "+X to [character] if adjacent to [character]"
      match = effect.match(/\+(\d+)\s+to\s+(.+?)\s+if\s+adjacent\s+to\s+(.+)/);
      if (match) {
        const bonus = parseInt(match[1]);
        const targetChar = match[2];
        const adjacentTo = match[3];
        
        // Check if this card is adjacent to the required character
        const isAdjacent = neighbors.some(idx => {
          const neighbor = ownBoard[idx];
          return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, adjacentTo);
        });
        
        if (isAdjacent) {
          // Apply bonus to all matching target characters on the board
          ownBoard.forEach(slot => {
            if (slot && !slot.cancelled && matchesTarget(slot.card, targetChar)) {
              slot.modifiedPoints += bonus;
            }
          });
        }
        continue;
      }
      
      // "+X to each [type]" (buffs each matching card)
      match = effect.match(/\+(\d+)\s+to\s+each\s+(.+)/);
      if (match && !effect.includes("neighboring") && !effect.includes("vehicle in play")) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (matchesTarget(slot.card, target)) {
              slot.modifiedPoints += bonus;
            }
          }
        });
        continue;
      }
      
      // "+X to each vehicle in play" - Jeremy Clarkson
      match = effect.match(/\+(\d+)\s+to\s+each\s+vehicle\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, "vehicle")) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "-X to each opposing [type]" - Miss Fritter
      match = effect.match(/-(\d+)\s+to\s+each\s+opposing\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        enemyBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "-X to each [type]" - Mr. Phillips Luzinsky
      match = effect.match(/-(\d+)\s+to\s+each\s+(.+)/);
      if (match && !effect.includes("opposing")) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id && matchesTarget(slot.card, target)) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "-X to each opposing card with a higher base value" - Monsieur Hood
      match = effect.match(/-(\d+)\s+to\s+each\s+opposing\s+card\s+with\s+(?:a\s+)?higher\s+base\s+value/);
      if (match) {
        const penalty = parseInt(match[1]);
        enemyBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.basePoints > sourceSlot.card.basePoints) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "+X to each own card with lower base value" - Monsieur Hood
      match = effect.match(/\+(\d+)\s+to\s+each\s+own\s+card\s+with\s+lower\s+base\s+value/);
      if (match) {
        const bonus = parseInt(match[1]);
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id && slot.card.basePoints < sourceSlot.card.basePoints) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "All [type] get +X for each [target] in play" - Planet Killer
      match = effect.match(/all\s+(.+?)\s+get\s+\+(\d+)\s+for\s+each\s+(.+?)(?:\s+in\s+play)?$/);
      if (match) {
        const targetType = match[1];
        const bonusPer = parseInt(match[2]);
        const countTarget = match[3];
        const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
        const count = allCards.filter(c => matchesTarget(c.card, countTarget)).length;
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, targetType)) {
            slot.modifiedPoints += bonusPer * count;
          }
        });
        continue;
      }
      
      // "+X to [character] for each [target] in play" - Stuart (+2 to Gru for each minion)
      match = effect.match(/\+(\d+)\s+to\s+(.+?)\s+for\s+each\s+(.+?)(?:\s+in\s+play)?$/);
      if (match) {
        const bonus = parseInt(match[1]);
        const targetChar = match[2];
        const countTarget = match[3];
        const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
        const count = allCards.filter(c => matchesTarget(c.card, countTarget)).length;
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, targetChar)) {
            slot.modifiedPoints += bonus * count;
          }
        });
        continue;
      }
      
      // "+X to each adjacent card" - Raj
      match = effect.match(/\+(\d+)\s+to\s+each\s+adjacent\s+card/);
      if (match) {
        const bonus = parseInt(match[1]);
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled) {
            neighbor.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "+X to all [type1]; +X to all [type2]" - Vector's Dad style compound buffs
      match = effect.match(/\+(\d+)\s+to\s+all\s+(.+)/);
      if (match && !effect.includes("cards")) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id && matchesTarget(slot.card, target)) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "+X to all [color] cards"
      match = effect.match(/\+(\d+)\s+to\s+all\s+(?:other\s+)?(.+?)\s+cards?/);
      if (match) {
        const bonus = parseInt(match[1]);
        const colorOrType = match[2].toUpperCase();
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (hasColor(slot.card, colorOrType) || matchesTarget(slot.card, colorOrType)) {
              slot.modifiedPoints += bonus;
            }
          }
        });
        continue;
      }
      
      // "+X to neighboring [target]" - James May style
      match = effect.match(/\+(\d+)\s+to\s+neighboring\s+(.+)/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target)) {
            neighbor.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "+X to any [target1] and any [target2]" or "+X to [target1] and [target2]" - Townsville
      match = effect.match(/\+(\d+)\s+to\s+(?:any\s+)?(.+?)\s+and\s+(?:any\s+)?(.+)/);
      if (match && !effect.includes("neighboring")) {
        const bonus = parseInt(match[1]);
        const target1 = match[2].trim();
        const target2 = match[3].trim();
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (matchesTarget(slot.card, target1) || matchesTarget(slot.card, target2)) {
              slot.modifiedPoints += bonus;
            }
          }
        });
        continue;
      }
      
      // "+X to any [character/type]" or "+X to [character]"
      match = effect.match(/\+(\d+)\s+to\s+(?:any\s+)?(.+?)(?:;|$)/);
      if (match && !effect.includes("all") && !effect.includes("each") && !effect.includes("adjacent") && !effect.includes("neighboring") && !effect.includes(" and ")) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (matchesTarget(slot.card, target)) {
              slot.modifiedPoints += bonus;
            }
          }
        });
        continue;
      }
      
      // "-X to all other [color] cards"
      match = effect.match(/-(\d+)\s+to\s+all\s+other\s+(.+?)\s+cards?/);
      if (match) {
        const penalty = parseInt(match[1]);
        const colorOrType = match[2].toUpperCase();
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (hasColor(slot.card, colorOrType) || matchesTarget(slot.card, colorOrType)) {
              slot.modifiedPoints -= penalty;
            }
          }
        });
        continue;
      }
      
      // "-X to all [type]"
      match = effect.match(/-(\d+)\s+to\s+all\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        // Apply to all matching cards on both sides
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            if (matchesTarget(slot.card, target)) {
              slot.modifiedPoints -= penalty;
            }
          }
        });
        continue;
      }
      
      // "-X to any [target]" (specific target debuff)
      match = effect.match(/-(\d+)\s+to\s+(?:any\s+)?(.+?)(?:;|$)/);
      if (match && !effect.includes("all") && !effect.includes("opposing") && !effect.includes("opposite")) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "-X to neighboring and opposite [type]"
      match = effect.match(/-(\d+)\s+to\s+neighboring\s+and\s+opposite\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        // Neighbors on own board
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target)) {
            neighbor.modifiedPoints -= penalty;
          }
        });
        // Opposite on enemy board
        const opposite = enemyBoard[oppositeIdx];
        if (opposite && !opposite.cancelled && matchesTarget(opposite.card, target)) {
          opposite.modifiedPoints -= penalty;
        }
        continue;
      }
      
      // "-X to each opposing [type]"
      match = effect.match(/-(\d+)\s+to\s+each\s+opposing\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const target = match[2];
        enemyBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "-X to opposing card if not a [type]" (also handles typo "it not a")
      match = effect.match(/-(\d+)\s+to\s+oppos(?:ing|ite)\s+card\s+(?:if|it)\s+not\s+(?:a|an)\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const exemptType = match[2];
        const opposite = enemyBoard[oppositeIdx];
        if (opposite && !opposite.cancelled && !matchesTarget(opposite.card, exemptType)) {
          opposite.modifiedPoints -= penalty;
        }
        continue;
      }
      
      // "-X to opposite card if not a [type]" (alternate wording)
      match = effect.match(/-(\d+)\s+to\s+opposite\s+card\s+if\s+not\s+(?:a|an)\s+(.+)/);
      if (match) {
        const penalty = parseInt(match[1]);
        const exemptType = match[2];
        const opposite = enemyBoard[oppositeIdx];
        if (opposite && !opposite.cancelled && !matchesTarget(opposite.card, exemptType)) {
          opposite.modifiedPoints -= penalty;
        }
        continue;
      }
      
      // "+X to all [number]s" (e.g., "+6 to all 8s")
      match = effect.match(/\+(\d+)\s+to\s+all\s+(\d+)s/);
      if (match) {
        const bonus = parseInt(match[1]);
        const targetPoints = parseInt(match[2]);
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.basePoints === targetPoints) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "+X to all [color] [number]s" (e.g., "+7 to all Yellow 7s", "+5 to all Green 7s")
      match = effect.match(/\+(\d+)\s+to\s+all\s+(\w+)\s+(\d+)s/);
      if (match) {
        const bonus = parseInt(match[1]);
        const targetColor = match[2].toUpperCase();
        const targetPoints = parseInt(match[3]);
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.basePoints === targetPoints && hasColor(slot.card, targetColor)) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "-X to all [color] [number]s" (e.g., "-4 to all Yellow 10s")
      match = effect.match(/-(\d+)\s+to\s+all\s+(\w+)\s+(\d+)s/);
      if (match) {
        const penalty = parseInt(match[1]);
        const targetColor = match[2].toUpperCase();
        const targetPoints = parseInt(match[3]);
        [...ownBoard, ...enemyBoard].forEach(slot => {
          if (slot && !slot.cancelled && slot.card.basePoints === targetPoints && hasColor(slot.card, targetColor)) {
            slot.modifiedPoints -= penalty;
          }
        });
        continue;
      }
      
      // "All [group] get +X for each [color1] card and -X for each [color2] card in play" (Frankie)
      match = effect.match(/all\s+(.+?)\s+get\s+\+(\d+)\s+for\s+each\s+(\w+)\s+card\s+and\s+-(\d+)\s+for\s+each\s+(\w+)\s+card/);
      if (match) {
        const targetGroup = match[1];
        const bonusPerColor1 = parseInt(match[2]);
        const color1 = match[3].toUpperCase();
        const penaltyPerColor2 = parseInt(match[4]);
        const color2 = match[5].toUpperCase();
        const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
        const color1Count = allCards.filter(c => hasColor(c.card, color1)).length;
        const color2Count = allCards.filter(c => hasColor(c.card, color2)).length;
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, targetGroup)) {
            slot.modifiedPoints += bonusPerColor1 * color1Count;
            slot.modifiedPoints -= penaltyPerColor2 * color2Count;
          }
        });
        continue;
      }
      
      // "Adjacent cards get -X for each [color] card in play" (Flea)
      match = effect.match(/adjacent\s+cards\s+get\s+-(\d+)\s+for\s+each\s+(\w+)\s+card/);
      if (match) {
        const penaltyPer = parseInt(match[1]);
        const color = match[2].toUpperCase();
        const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
        const colorCount = allCards.filter(c => hasColor(c.card, color)).length;
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled) {
            neighbor.modifiedPoints -= penaltyPer * colorCount;
          }
        });
        continue;
      }
      
      // "x2 to [target]" or "x3 to [target]" (simple multiplier)
      match = effect.match(/x(\d)\s+to\s+(?:any\s+)?(.+?)(?:;|$)/);
      if (match && !effect.includes("neighboring") && !effect.includes("if")) {
        const multiplier = parseInt(match[1]);
        const target = match[2];
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
            slot.modifiedPoints *= multiplier;
          }
        });
        continue;
      }
      
      // "x2 to [target] if [condition] is in play" or "x3 to [target] if [condition] is in play"
      match = effect.match(/x(\d)\s+to\s+(.+?)\s+if\s+(?:the\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const multiplier = parseInt(match[1]);
        const target = match[2];
        const condition = match[3];
        if (allActiveCards.some(c => matchesTarget(c.card, condition))) {
          ownBoard.forEach(slot => {
            if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
              slot.modifiedPoints *= multiplier;
            }
          });
        }
        continue;
      }
      
      // "x3 to any neighboring [target]" or "x3 to each neighboring [target]"
      match = effect.match(/x3\s+to\s+(?:any|each)\s+neighboring\s+(.+)/);
      if (match) {
        const target = match[1];
        neighbors.forEach(idx => {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, target)) {
            neighbor.modifiedPoints *= 3;
          }
        });
        continue;
      }
      
      // === NEW EFFECTS: Sacrifice, Swap ===
      
      // "Cancel this card to give +X to all your other cards" (Sacrifice)
      match = effect.match(/cancel\s+this\s+card\s+to\s+give\s+\+(\d+)\s+to\s+all/);
      if (match) {
        const bonus = parseInt(match[1]);
        sourceSlot.cancelled = true;
        ownBoard.forEach(slot => {
          if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
            slot.modifiedPoints += bonus;
          }
        });
        continue;
      }
      
      // "Swap points with neighboring [target]" or "Swap points with a neighboring card"
      match = effect.match(/swap\s+points\s+with\s+(?:a\s+)?neighboring\s+(.+)?/);
      if (match) {
        const target = match[1] || "card";
        for (const idx of neighbors) {
          const neighbor = ownBoard[idx];
          if (neighbor && !neighbor.cancelled && (target === "card" || matchesTarget(neighbor.card, target))) {
            // Swap the modified points
            const tempPoints = sourceSlot.modifiedPoints;
            sourceSlot.modifiedPoints = neighbor.modifiedPoints;
            neighbor.modifiedPoints = tempPoints;
            break; // Only swap with first matching neighbor
          }
        }
        continue;
      }
    }
  };
  
  // Apply buffs/debuffs
  allPlayerCards.forEach(slot => applyBuffsDebuffs(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyBuffsDebuffs(slot, opponentBoard, playerBoard, false));
  
  // Third pass: handle special effects like "cancel power" and "steal buff"
  const applySpecialEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    const oppositeCard = enemyBoard[oppositeIdx];
    
    // "If the opposite card is a villain, cancel its power"
    let match = desc.match(/if\s+the\s+opposite\s+card\s+is\s+(?:a\s+)?(.+?),?\s+cancel\s+its\s+power/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const targetType = match[1];
      if (matchesTarget(oppositeCard.card, targetType)) {
        // Reset opposite card to base points (effectively cancelling buffs/debuffs from its power)
        oppositeCard.modifiedPoints = oppositeCard.card.basePoints;
      }
    }
    
    // "Steal random buff from opposite toon"
    if (desc.includes("steal") && desc.includes("buff") && desc.includes("opposite")) {
      if (oppositeCard && !oppositeCard.cancelled) {
        const buffAmount = oppositeCard.modifiedPoints - oppositeCard.card.basePoints;
        if (buffAmount > 0) {
          // Steal the buff
          sourceSlot.modifiedPoints += buffAmount;
          oppositeCard.modifiedPoints = oppositeCard.card.basePoints;
        }
      }
    }
    
    // "Cancel out opposite gtoon" - The Chameleon
    if (desc.includes("cancel out opposite") || desc.includes("cancel opposite")) {
      if (oppositeCard && !oppositeCard.cancelled) {
        oppositeCard.cancelled = true;
      }
    }
    
    // "-X to opponents [type]" or "-X to opponent's [type]"
    match = desc.match(/-(\d+)\s+to\s+opponents?'?\s+(.+)/);
    if (match) {
      const penalty = parseInt(match[1]);
      const target = match[2];
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
          slot.modifiedPoints -= penalty;
        }
      });
    }
    
    // "-X to any [target1], [target2], or [target3] in play" - Sarah the Elderly
    match = desc.match(/-(\d+)\s+to\s+any\s+(.+?)\s+in\s+play/i);
    if (match) {
      const penalty = parseInt(match[1]);
      const targetStr = match[2];
      // Parse "Ed, Edd, or Eddy" style targets
      const targets = targetStr.split(/,\s*|\s+or\s+/).map(t => t.trim()).filter(t => t);
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled && slot.card.id !== sourceSlot.card.id) {
        if (targets.some(t => matchesTarget(slot.card, t))) {
            slot.modifiedPoints -= penalty;
          }
        }
      });
    }
    
    // Darth Anakin: "If countClones > countDroids, Anakin (+3 for each Clone); else Vader (+3 for each Droid)"
    if (desc.includes("countclones") && desc.includes("countdroids")) {
      const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
      const cloneCount = allCards.filter(c => matchesTarget(c.card, "clone")).length;
      const droidCount = allCards.filter(c => matchesTarget(c.card, "droid")).length;
      if (cloneCount > droidCount) {
        sourceSlot.modifiedPoints += 3 * cloneCount;
      } else {
        sourceSlot.modifiedPoints += 3 * droidCount;
      }
    }
    
    // Fairy Godmother: "Set Opponent's Strongest Hero to Villain and recalculate buffs"
    if (desc.includes("opponent's strongest hero") && desc.includes("villain")) {
      // Find the opponent's strongest hero
      let strongestHero: PlacedCard | null = null;
      let strongestPoints = -1;
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled && matchesTarget(slot.card, "hero")) {
          if (slot.card.basePoints > strongestPoints) {
            strongestPoints = slot.card.basePoints;
            strongestHero = slot;
          }
        }
      });
      
      if (strongestHero) {
        // Convert HERO type to VILLAIN type
        const heroSlot = strongestHero as PlacedCard;
        const newTypes = heroSlot.card.types.filter(t => t !== "HERO");
        if (!newTypes.includes("VILLAIN")) {
          newTypes.push("VILLAIN");
        }
        // Create a modified card with updated types
        heroSlot.card = { ...heroSlot.card, types: newTypes };
      }
    }
    
    // Vanellope: "If played in the 2nd round, can swap positions with choice of your first round toons"
    if (desc.includes("swap positions") && desc.includes("2nd round") && isRound2Position(sourceSlot.position)) {
      // Find the best round 1 card to swap with (highest base points)
      let bestSwapIdx = -1;
      let bestSwapPoints = -1;
      for (let i = 0; i < 4; i++) {
        const slot = ownBoard[i];
        if (slot && !slot.cancelled && slot.card.basePoints > bestSwapPoints) {
          bestSwapPoints = slot.card.basePoints;
          bestSwapIdx = i;
        }
      }
      
      if (bestSwapIdx >= 0) {
        const round1Slot = ownBoard[bestSwapIdx];
        if (round1Slot) {
          // Swap positions
          const tempCard = { ...sourceSlot.card };
          const tempModified = sourceSlot.modifiedPoints;
          const tempCancelled = sourceSlot.cancelled;
          
          sourceSlot.card = round1Slot.card;
          sourceSlot.modifiedPoints = round1Slot.card.basePoints;
          sourceSlot.cancelled = round1Slot.cancelled;
          
          round1Slot.card = tempCard;
          round1Slot.modifiedPoints = tempCard.basePoints;
          round1Slot.cancelled = tempCancelled;
        }
      }
    }
    
    // "Opposing card loses all adjacency effects" - Dee Dee, Lawrence Fletcher, Otto Osworth
    if (desc.includes("opposing card loses all adjacency")) {
      const oppositeCard = enemyBoard[oppositeIdx];
      if (oppositeCard && !oppositeCard.cancelled) {
        // Check if the opposite card has any adjacency-based effects in its description
        const oppDesc = oppositeCard.card.description.toLowerCase();
        if (oppDesc.includes("next to") || oppDesc.includes("adjacent") || oppDesc.includes("neighboring")) {
          // Reset to base points, removing any adjacency bonuses
          oppositeCard.modifiedPoints = oppositeCard.card.basePoints;
        }
      }
    }
    
    // === NEW SPECIAL EFFECTS ===
    
    // "Steal X points from opposing card" or "Steal X points from opposite card"
    let stealMatch = desc.match(/steal\s+(\d+)\s+points?\s+from\s+oppos(?:ing|ite)\s+card/);
    if (stealMatch && oppositeCard && !oppositeCard.cancelled && !sourceSlot.shielded) {
      const stealAmount = parseInt(stealMatch[1]);
      const actualSteal = Math.min(stealAmount, oppositeCard.modifiedPoints);
      sourceSlot.modifiedPoints += actualSteal;
      oppositeCard.modifiedPoints -= actualSteal;
      oppositeCard.stolenPoints = (oppositeCard.stolenPoints || 0) + actualSteal;
    }
    
    // "Steal X points from each opponent card" or "Steal X points from all opposing cards"
    stealMatch = desc.match(/steal\s+(\d+)\s+points?\s+from\s+(?:each|all)\s+oppos(?:ing|ent)\s+cards?/);
    if (stealMatch) {
      const stealAmount = parseInt(stealMatch[1]);
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          const actualSteal = Math.min(stealAmount, slot.modifiedPoints);
          sourceSlot.modifiedPoints += actualSteal;
          slot.modifiedPoints -= actualSteal;
          slot.stolenPoints = (slot.stolenPoints || 0) + actualSteal;
        }
      });
    }
    
    // "Steal the effect from opposite card" - copies the point modification from opposite
    if (desc.includes("steal") && desc.includes("effect") && (desc.includes("opposite") || desc.includes("opposing"))) {
      if (oppositeCard && !oppositeCard.cancelled) {
        const oppBonus = oppositeCard.modifiedPoints - oppositeCard.card.basePoints;
        if (oppBonus !== 0) {
          // Steal the effect: add it to self, remove from opposite
          sourceSlot.modifiedPoints += oppBonus;
          oppositeCard.modifiedPoints = oppositeCard.card.basePoints;
        }
      }
    }
    
    // "Double the effect of the card to the left" 
    if (desc.includes("double") && desc.includes("effect") && desc.includes("to the left")) {
      const leftIdx = sourceSlot.position - 1;
      // Only valid within same row (0-3 for round 1, 4-6 for round 2)
      const sameRow = (sourceSlot.position < 4 && leftIdx >= 0) || (sourceSlot.position >= 4 && leftIdx >= 4);
      if (sameRow && leftIdx >= 0) {
        const leftCard = ownBoard[leftIdx];
        if (leftCard && !leftCard.cancelled) {
          const bonus = leftCard.modifiedPoints - leftCard.card.basePoints;
          if (bonus !== 0) {
            leftCard.modifiedPoints += bonus; // Double by adding the bonus again
          }
        }
      }
    }
    
    // "Double the effect of the card to the right"
    if (desc.includes("double") && desc.includes("effect") && desc.includes("to the right")) {
      const rightIdx = sourceSlot.position + 1;
      // Only valid within same row (0-3 for round 1, 4-6 for round 2)
      const sameRow = (sourceSlot.position < 4 && rightIdx <= 3) || (sourceSlot.position >= 4 && rightIdx <= 6);
      if (sameRow) {
        const rightCard = ownBoard[rightIdx];
        if (rightCard && !rightCard.cancelled) {
          const bonus = rightCard.modifiedPoints - rightCard.card.basePoints;
          if (bonus !== 0) {
            rightCard.modifiedPoints += bonus; // Double by adding the bonus again
          }
        }
      }
    }
    
    // "Cancel a random opponent's gtoon"
    if (desc.includes("cancel") && desc.includes("random") && desc.includes("opponent")) {
      const activeOpponentCards = enemyBoard
        .map((slot, idx) => ({ slot, idx }))
        .filter(({ slot }) => slot && !slot.cancelled && !slot.shielded);
      if (activeOpponentCards.length > 0) {
        const randomIdx = Math.floor(Math.random() * activeOpponentCards.length);
        const targetCard = activeOpponentCards[randomIdx];
        if (targetCard.slot) {
          targetCard.slot.cancelled = true;
        }
      }
    }
    
    // "Mirror opposing card's effect" or "Copy opposing card's power"
    if ((desc.includes("mirror") || desc.includes("copy")) && 
        (desc.includes("opposing") || desc.includes("opposite")) && 
        (desc.includes("effect") || desc.includes("power")) &&
        !desc.includes("steal")) {
      if (oppositeCard && !oppositeCard.cancelled) {
        // Simple implementation: gain the same point modification the opposing card got
        const oppBonus = oppositeCard.modifiedPoints - oppositeCard.card.basePoints;
        if (oppBonus > 0) {
          sourceSlot.modifiedPoints += oppBonus;
        }
      }
    }
    
    // "+X for each negative effect on your cards" (Counter effect)
    const counterMatch = desc.match(/\+(\d+)\s+for\s+each\s+negative\s+effect/);
    if (counterMatch) {
      const bonus = parseInt(counterMatch[1]);
      let negativeCount = 0;
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          // Count cards with points below base or with stolen points
          if (slot.modifiedPoints < slot.card.basePoints || (slot.stolenPoints && slot.stolenPoints > 0)) {
            negativeCount++;
          }
        }
      });
      sourceSlot.modifiedPoints += bonus * negativeCount;
    }
    
    // "+X if your total is lower than opponent's" (Underdog effect)
    const underdogMatch = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?total\s+(?:is\s+)?lower/);
    if (underdogMatch) {
      const bonus = parseInt(underdogMatch[1]);
      const ownTotal = ownBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
      const enemyTotal = enemyBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
      if (ownTotal < enemyTotal) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "x2 if your total is lower than opponent's" (Underdog multiplier)
    if (desc.includes("x2") && desc.includes("total") && desc.includes("lower")) {
      const ownTotal = ownBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
      const enemyTotal = enemyBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
      if (ownTotal < enemyTotal) {
        sourceSlot.modifiedPoints *= 2;
      }
    }
    
    // "Double each neighboring card's effect" (Echo effect)
    if (desc.includes("double") && desc.includes("neighboring") && desc.includes("effect")) {
      const neighbors = getNeighborIndices(sourceSlot.position);
      neighbors.forEach(idx => {
        const neighbor = ownBoard[idx];
        if (neighbor && !neighbor.cancelled) {
          const bonus = neighbor.modifiedPoints - neighbor.card.basePoints;
          if (bonus > 0) {
            neighbor.modifiedPoints += bonus; // Double the effect by adding it again
          }
        }
      });
    }
    
    // "+X for each card with a triggered effect" (Amplify effect)
    const amplifyMatch = desc.match(/\+(\d+)\s+for\s+each\s+card\s+with\s+(?:a\s+)?triggered\s+effect/);
    if (amplifyMatch) {
      const bonus = parseInt(amplifyMatch[1]);
      let effectCount = 0;
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled) {
          const slotDesc = slot.card.description.toLowerCase();
          // Count cards whose points differ from base (they had an effect trigger)
          if (slotDesc !== "no power" && slotDesc !== "no powers" && slot.modifiedPoints !== slot.card.basePoints) {
            effectCount++;
          }
        }
      });
      sourceSlot.modifiedPoints += bonus * effectCount;
    }
    
    // "Immune to negative effects" or "Cannot receive negative effects"
    if ((desc.includes("immune to negative") || desc.includes("cannot receive negative")) && !sourceSlot.shielded) {
      // If this card received any debuffs, restore to base
      if (sourceSlot.modifiedPoints < sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints = sourceSlot.card.basePoints;
      }
    }
    
    // "+X for each card still in your hand" (Resource effect)
    const handMatch = desc.match(/\+(\d+)\s+for\s+each\s+card\s+(?:still\s+)?in\s+(?:your\s+)?hand/);
    if (handMatch) {
      const bonus = parseInt(handMatch[1]);
      const playedCount = ownBoard.filter(s => s !== null).length;
      const cardsInHand = 7 - playedCount; // Max 7 cards in deck
      sourceSlot.modifiedPoints += bonus * cardsInHand;
    }
    
    // "+X for each card in opponent's hand"
    const oppHandMatch = desc.match(/\+(\d+)\s+for\s+each\s+card\s+in\s+opponent'?s?\s+hand/);
    if (oppHandMatch) {
      const bonus = parseInt(oppHandMatch[1]);
      const oppPlayedCount = enemyBoard.filter(s => s !== null).length;
      const oppCardsInHand = 7 - oppPlayedCount;
      sourceSlot.modifiedPoints += bonus * oppCardsInHand;
    }
    
    // "Copy this card's base points to neighboring cards" (Echo Base)
    if (desc.includes("copy") && desc.includes("base points") && desc.includes("neighbor")) {
      const neighbors = getNeighborIndices(sourceSlot.position);
      neighbors.forEach(idx => {
        const neighbor = ownBoard[idx];
        if (neighbor && !neighbor.cancelled) {
          neighbor.modifiedPoints = sourceSlot.card.basePoints;
        }
      });
    }
    
    // "Reduce all opponent cards by X points" (Sabotage)
    const sabotageMatch = desc.match(/reduce\s+all\s+opponent\s+cards?\s+by\s+(\d+)/);
    if (sabotageMatch) {
      const penalty = parseInt(sabotageMatch[1]);
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled && !slot.shielded) {
          slot.modifiedPoints -= penalty;
        }
      });
    }
    
    // "Lock this slot" - mark as super shielded (cannot be affected at all)
    if (desc.includes("lock this slot") || desc.includes("cannot be affected")) {
      sourceSlot.shielded = true;
    }
    
    // "This card counts as all colors" - wild card for color conditions
    if (desc.includes("counts as all colors") || desc.includes("count as all colors")) {
      sourceSlot.countsAsAllColors = true;
    }
    
    // "Negate the color bonus this round" - cancel color counting for this slot
    if (desc.includes("negate") && desc.includes("color bonus")) {
      // Mark own slot as not counting for colors (handled in scoring)
      sourceSlot.countsAsAllColors = false;
    }
    
    // "Change the color condition to [color]" - modifies mainColors for scoring
    const changeColorMatch = desc.match(/change\s+(?:the\s+)?color\s+condition\s+to\s+(\w+)/);
    if (changeColorMatch) {
      const newColor = changeColorMatch[1].toUpperCase();
      // This will be applied to the state during final scoring
      (sourceSlot as any).changesColorConditionTo = newColor;
    }
    
    // "Convert all [colorA] cards to [colorB]" - changes card colors
    const convertMatch = desc.match(/convert\s+all\s+(\w+)\s+(?:cards?\s+)?to\s+(\w+)/);
    if (convertMatch) {
      const fromColor = convertMatch[1].toUpperCase();
      const toColor = convertMatch[2].toUpperCase();
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled) {
          if (slot.card.colors.includes(fromColor)) {
            slot.convertedColors = slot.convertedColors || [...slot.card.colors];
            slot.convertedColors = slot.convertedColors.filter(c => c !== fromColor);
            if (!slot.convertedColors.includes(toColor)) {
              slot.convertedColors.push(toColor);
            }
          }
        }
      });
    }
    
    // "Swap board positions with opposite card" - physically swap positions
    if (desc.includes("swap") && desc.includes("position") && (desc.includes("opposite") || desc.includes("opposing"))) {
      if (oppositeCard && !oppositeCard.cancelled && !oppositeCard.shielded) {
        // Swap the modifiedPoints and card references conceptually
        // Store original positions for tracking
        const tempPoints = sourceSlot.modifiedPoints;
        const tempCard = sourceSlot.card;
        sourceSlot.swappedPosition = oppositeCard.position;
        oppositeCard.swappedPosition = sourceSlot.position;
        // Note: actual board position swap would need more complex handling
        // For simplicity, we swap the point values which achieves similar effect
        sourceSlot.modifiedPoints = oppositeCard.modifiedPoints;
        oppositeCard.modifiedPoints = tempPoints;
      }
    }
    
    // "Reverse scoring - lowest total wins this round"
    if (desc.includes("reverse") && desc.includes("scoring") && desc.includes("lowest")) {
      // Mark for reverse scoring - handled in determineWinner
      (sourceSlot as any).triggersReverseScoring = true;
    }
    
    // "If this card wins its matchup, give +X to next card" (Chain effect)
    const chainMatch = desc.match(/if\s+this\s+card\s+wins.*\+(\d+)\s+to\s+next/);
    if (chainMatch && oppositeCard) {
      const bonus = parseInt(chainMatch[1]);
      // Check if this card wins against opposite
      if (!sourceSlot.cancelled && !oppositeCard.cancelled && 
          sourceSlot.modifiedPoints > oppositeCard.modifiedPoints) {
        // Give bonus to next card (next position on own board)
        const nextIdx = sourceSlot.position + 1;
        if (nextIdx < ownBoard.length && ownBoard[nextIdx] && !ownBoard[nextIdx]!.cancelled) {
          ownBoard[nextIdx]!.modifiedPoints += bonus;
        }
      }
    }
  };
  
  // Fourth pass: Handle round-specific effects
  const applyRoundEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    // "-X to all [type] played in 2nd round"
    let match = desc.match(/-(\d+)\s+to\s+all\s+(.+?)\s+played\s+in\s+2nd\s+round/);
    if (match) {
      const penalty = parseInt(match[1]);
      const target = match[2];
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled && isRound2Position(slot.position) && matchesTarget(slot.card, target)) {
          slot.modifiedPoints -= penalty;
        }
      });
    }
    
    // "-X to each [type] played in the 2nd round"
    match = desc.match(/-(\d+)\s+to\s+each\s+(.+?)\s+played\s+in\s+(?:the\s+)?2nd\s+round/);
    if (match) {
      const penalty = parseInt(match[1]);
      const target = match[2];
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled && isRound2Position(slot.position) && matchesTarget(slot.card, target)) {
          slot.modifiedPoints -= penalty;
        }
      });
    }
    
    // "-X to all [type] played in the first round" - Tai Lung
    match = desc.match(/-(\d+)\s+to\s+all\s+(.+?)\s+played\s+in\s+(?:the\s+)?first\s+round/);
    if (match) {
      const penalty = parseInt(match[1]);
      const target = match[2];
      [...ownBoard, ...enemyBoard].forEach(slot => {
        if (slot && !slot.cancelled && !isRound2Position(slot.position) && matchesTarget(slot.card, target)) {
          slot.modifiedPoints -= penalty;
        }
      });
    }
    // "+X to each own [type] played in round 1" (when played in round 1)
    match = desc.match(/if\s+played\s+in\s+round\s+1[,;]?\s*\+(\d+)\s+to\s+each\s+own\s+(.+?)\s+played\s+in\s+round\s+1/);
    if (match && !isRound2Position(sourceSlot.position)) {
      const bonus = parseInt(match[1]);
      const target = match[2];
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled && !isRound2Position(slot.position) && matchesTarget(slot.card, target)) {
          slot.modifiedPoints += bonus;
        }
      });
    }
    
    // "+X to each own [type]" when played in round 2 - e.g. Anna's round 2 effect
    match = desc.match(/if\s+played\s+in\s+round\s+2[,;]?\s*\+(\d+)\s+to\s+each\s+own\s+(.+)/);
    if (match && isRound2Position(sourceSlot.position)) {
      const bonus = parseInt(match[1]);
      const target = match[2];
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
          slot.modifiedPoints += bonus;
        }
      });
    }
    
    // "+X for each [type] played in the first round"
    match = desc.match(/\+(\d+)\s+for\s+each\s+(.+?)\s+played\s+in\s+(?:the\s+)?first\s+round/);
    if (match) {
      const bonus = parseInt(match[1]);
      const target = match[2];
      const allCards = [...ownBoard, ...enemyBoard];
      const count = allCards.filter(slot => 
        slot && !slot.cancelled && !isRound2Position(slot.position) && matchesTarget(slot.card, target)
      ).length;
      sourceSlot.modifiedPoints += bonus * count;
    }
    
    // "If played in the 1st round, remove X damage from each adjacent 2nd round card"
    match = desc.match(/if\s+played\s+in\s+(?:the\s+)?1st\s+round[,;]?\s*remove\s+(\d+)\s+damage\s+from\s+each\s+adjacent\s+2nd\s+round\s+card/);
    if (match && !isRound2Position(sourceSlot.position)) {
      const healAmount = parseInt(match[1]);
      const neighbors = getNeighborIndices(sourceSlot.position);
      neighbors.forEach(idx => {
        const neighbor = ownBoard[idx];
        if (neighbor && !neighbor.cancelled && isRound2Position(neighbor.position)) {
          neighbor.modifiedPoints += healAmount;
        }
      });
    }
    
    // "+X to [target] for each [other] in play"
    match = desc.match(/\+(\d+)\s+to\s+(.+?)\s+for\s+each\s+(.+?)\s+in\s+play/);
    if (match) {
      const bonus = parseInt(match[1]);
      const target = match[2];
      const countTarget = match[3];
      const allCards = [...ownBoard, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
      const count = allCards.filter(c => matchesTarget(c.card, countTarget)).length;
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
          slot.modifiedPoints += bonus * count;
        }
      });
    }
  };
  
  // Fifth pass: Handle Dende-like effects (convert negative to positive)
  const applyFinalEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    
    // "Before scoring, if any of your gToon's points are negative, remove - to become positive"
    if (desc.includes("negative") && desc.includes("positive")) {
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled && slot.modifiedPoints < 0) {
          slot.modifiedPoints = Math.abs(slot.modifiedPoints);
        }
      });
    }
  };
  
  // Sixth pass: Apply match-based effects (score comparisons, play order, etc.)
  const applyMatchBasedEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const round1PlayerScore = state.round1PlayerScore || 0;
    const round1OpponentScore = state.round1OpponentScore || 0;
    const myR1Score = isPlayer ? round1PlayerScore : round1OpponentScore;
    const theirR1Score = isPlayer ? round1OpponentScore : round1PlayerScore;
    
    // Calculate current scores
    const currentOwnScore = ownBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
    const currentEnemyScore = enemyBoard.filter(s => s && !s.cancelled).reduce((sum, s) => sum + (s?.modifiedPoints || 0), 0);
    
    // "+X if your round 1 score was higher than opponent's"
    let match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?round\s*1\s+score\s+(?:was\s+)?higher/);
    if (match) {
      const bonus = parseInt(match[1]);
      if (myR1Score > theirR1Score) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if your round 1 score was lower than opponent's" (underdog)
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?round\s*1\s+score\s+(?:was\s+)?lower/);
    if (match) {
      const bonus = parseInt(match[1]);
      if (myR1Score < theirR1Score) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "x2 if your round 1 score was lower than opponent's"
    if (desc.includes("x2") && desc.includes("round 1 score") && desc.includes("lower")) {
      if (myR1Score < theirR1Score) {
        sourceSlot.modifiedPoints *= 2;
      }
    }
    
    // "+X if your current score is higher than opponent's"
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?current\s+score\s+is\s+higher/);
    if (match) {
      const bonus = parseInt(match[1]);
      if (currentOwnScore > currentEnemyScore) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if your current score is lower than opponent's"
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?current\s+score\s+is\s+lower/);
    if (match) {
      const bonus = parseInt(match[1]);
      if (currentOwnScore < currentEnemyScore) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if this card's score beats opposite card"
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    const oppositeCard = enemyBoard[oppositeIdx];
    match = desc.match(/\+(\d+)\s+if\s+this\s+card'?s?\s+score\s+beats\s+opposite/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (sourceSlot.modifiedPoints > oppositeCard.modifiedPoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "x2 if this card's score beats opposite card"
    if (desc.includes("x2") && desc.includes("beats opposite")) {
      if (oppositeCard && !oppositeCard.cancelled && sourceSlot.modifiedPoints > oppositeCard.modifiedPoints) {
        sourceSlot.modifiedPoints *= 2;
      }
    }
    
    // "+X if played first this round"
    match = desc.match(/\+(\d+)\s+if\s+played\s+first\s+this\s+round/);
    if (match) {
      const bonus = parseInt(match[1]);
      const isRound2 = isRound2Position(sourceSlot.position);
      const roundStartPosition = isRound2 ? 4 : 0;
      if (sourceSlot.position === roundStartPosition) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if played second this round"
    match = desc.match(/\+(\d+)\s+if\s+played\s+second\s+this\s+round/);
    if (match) {
      const bonus = parseInt(match[1]);
      const isRound2 = isRound2Position(sourceSlot.position);
      const secondPosition = isRound2 ? 5 : 1;
      if (sourceSlot.position === secondPosition) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if played in slot N"
    match = desc.match(/\+(\d+)\s+if\s+played\s+in\s+slot\s+(\d+)/);
    if (match) {
      const bonus = parseInt(match[1]);
      const targetSlot = parseInt(match[2]) - 1; // Convert to 0-indexed
      if (sourceSlot.position === targetSlot) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if your prior played card was a [type]"
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?prior\s+(?:played\s+)?card\s+was\s+(?:a\s+)?(.+)/);
    if (match && sourceSlot.priorCardId) {
      const bonus = parseInt(match[1]);
      const priorType = match[2];
      const priorCard = ownBoard.find(s => s && s.card.id === sourceSlot.priorCardId);
      if (priorCard && matchesTarget(priorCard.card, priorType)) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if played after a [type]"
    match = desc.match(/\+(\d+)\s+if\s+played\s+after\s+(?:a\s+)?(.+)/);
    if (match && sourceSlot.priorCardId) {
      const bonus = parseInt(match[1]);
      const targetType = match[2];
      const priorCard = ownBoard.find(s => s && s.card.id === sourceSlot.priorCardId);
      if (priorCard && matchesTarget(priorCard.card, targetType)) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if prior card had higher base points"
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?prior\s+(?:played\s+)?card\s+had\s+higher\s+base/);
    if (match && sourceSlot.priorCardId) {
      const bonus = parseInt(match[1]);
      const priorCard = ownBoard.find(s => s && s.card.id === sourceSlot.priorCardId);
      if (priorCard && priorCard.card.basePoints > sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if prior card had lower base points"
    match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?prior\s+(?:played\s+)?card\s+had\s+lower\s+base/);
    if (match && sourceSlot.priorCardId) {
      const bonus = parseInt(match[1]);
      const priorCard = ownBoard.find(s => s && s.card.id === sourceSlot.priorCardId);
      if (priorCard && priorCard.card.basePoints < sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
  };
  
  // Seventh pass: Apply opponent-dependent effects
  const applyOpponentDependentEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    const oppositeCard = enemyBoard[oppositeIdx];
    const neighbors = getNeighborIndices(sourceSlot.position);
    
    // "+X if opposite card has higher base points"
    let match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+has\s+higher\s+base/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (oppositeCard.card.basePoints > sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card has lower base points"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+has\s+lower\s+base/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (oppositeCard.card.basePoints < sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "x2 if opposite card has higher base points"
    if (desc.includes("x2") && desc.includes("opposite") && desc.includes("higher base")) {
      if (oppositeCard && !oppositeCard.cancelled && oppositeCard.card.basePoints > sourceSlot.card.basePoints) {
        sourceSlot.modifiedPoints *= 2;
      }
    }
    
    // "+X if opposite card is the same color"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+is\s+(?:the\s+)?same\s+color/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      const sameColor = sourceSlot.card.colors.some(c => oppositeCard.card.colors.includes(c));
      if (sameColor) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card is a different color"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+is\s+(?:a\s+)?different\s+color/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      const sameColor = sourceSlot.card.colors.some(c => oppositeCard.card.colors.includes(c));
      if (!sameColor) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card is [color]"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+is\s+(\w+)(?:\s+card)?/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      const targetColor = match[2].toUpperCase();
      if (hasColor(oppositeCard.card, targetColor)) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card is a [type]"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+is\s+(?:a\s+)?(\w+)(?:\s+card)?$/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      const targetType = match[2];
      if (matchesTarget(oppositeCard.card, targetType)) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card's effect is active"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card'?s?\s+effect\s+is\s+active/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (oppositeCard.modifiedPoints !== oppositeCard.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card has no active effect"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+has\s+no\s+active\s+effect/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (oppositeCard.modifiedPoints === oppositeCard.card.basePoints) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opposite card has a cancel effect"
    match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+has\s+(?:a\s+)?cancel\s+effect/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (oppositeCard.card.description.toLowerCase().includes("cancel")) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opponent has any [type] in play"
    match = desc.match(/\+(\d+)\s+if\s+opponent\s+has\s+any\s+(.+?)\s+in\s+play/);
    if (match) {
      const bonus = parseInt(match[1]);
      const targetType = match[2];
      if (enemyBoard.some(s => s && !s.cancelled && matchesTarget(s.card, targetType))) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if opponent has any [color] card in play"
    match = desc.match(/\+(\d+)\s+if\s+opponent\s+has\s+any\s+(\w+)\s+card\s+in\s+play/);
    if (match) {
      const bonus = parseInt(match[1]);
      const targetColor = match[2].toUpperCase();
      if (enemyBoard.some(s => s && !s.cancelled && hasColor(s.card, targetColor))) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if same color as a neighboring card"
    match = desc.match(/\+(\d+)\s+if\s+same\s+color\s+as\s+(?:a\s+)?neighboring/);
    if (match) {
      const bonus = parseInt(match[1]);
      const hasMatchingNeighbor = neighbors.some(idx => {
        const neighbor = ownBoard[idx];
        if (!neighbor || neighbor.cancelled) return false;
        return sourceSlot.card.colors.some(c => neighbor.card.colors.includes(c));
      });
      if (hasMatchingNeighbor) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if different color from all neighboring cards"
    match = desc.match(/\+(\d+)\s+if\s+different\s+color\s+from\s+(?:all\s+)?neighboring/);
    if (match) {
      const bonus = parseInt(match[1]);
      const allDifferent = neighbors.every(idx => {
        const neighbor = ownBoard[idx];
        if (!neighbor || neighbor.cancelled) return true;
        return !sourceSlot.card.colors.some(c => neighbor.card.colors.includes(c));
      });
      if (allDifferent) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
  };
  
  // Eighth pass: Apply Slam/rarity conditions
  const applySlamEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    const oppositeCard = enemyBoard[oppositeIdx];
    
    // Slam card IDs
    const slamCardIds = [82, 171, 175, 229, 238, 249, 302, 323, 354, 404, 438, 455];
    
    // "+X if opposite card is a Slam rarity"
    let match = desc.match(/\+(\d+)\s+if\s+opposite\s+card\s+is\s+(?:a\s+)?slam/);
    if (match && oppositeCard && !oppositeCard.cancelled) {
      const bonus = parseInt(match[1]);
      if (slamCardIds.includes(oppositeCard.card.id) || oppositeCard.card.rarity === "SLAM") {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "x2 if opposite card is a Slam rarity"
    if (desc.includes("x2") && desc.includes("opposite") && desc.includes("slam")) {
      if (oppositeCard && !oppositeCard.cancelled && (slamCardIds.includes(oppositeCard.card.id) || oppositeCard.card.rarity === "SLAM")) {
        sourceSlot.modifiedPoints *= 2;
      }
    }
    
    // "Cancel opposite card if it is a Slam rarity"
    if (desc.includes("cancel opposite") && desc.includes("slam")) {
      if (oppositeCard && !oppositeCard.cancelled && !oppositeCard.shielded && (slamCardIds.includes(oppositeCard.card.id) || oppositeCard.card.rarity === "SLAM")) {
        oppositeCard.cancelled = true;
      }
    }
    
    // "+X if opponent has any Slam card in play"
    match = desc.match(/\+(\d+)\s+if\s+opponent\s+has\s+any\s+slam\s+card/);
    if (match) {
      const bonus = parseInt(match[1]);
      if (enemyBoard.some(s => s && !s.cancelled && (slamCardIds.includes(s.card.id) || s.card.rarity === "SLAM"))) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if no Slam cards are in play"
    match = desc.match(/\+(\d+)\s+if\s+no\s+slam\s+cards?\s+(?:are\s+)?in\s+play/);
    if (match) {
      const bonus = parseInt(match[1]);
      const allCards = [...ownBoard, ...enemyBoard];
      if (!allCards.some(s => s && !s.cancelled && (slamCardIds.includes(s.card.id) || s.card.rarity === "SLAM"))) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
  };
  
  // Ninth pass: Apply transform effects
  const applyTransformEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    const neighbors = getNeighborIndices(sourceSlot.position);
    const oppositeIdx = getOppositeIndex(sourceSlot.position);
    
    // "Change all your cards to [type]"
    let match = desc.match(/change\s+all\s+(?:your\s+)?cards?\s+to\s+(\w+)(?:\s+type)?/);
    if (match && !desc.includes("opponent")) {
      const newType = match[1].toUpperCase();
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          slot.convertedTypes = slot.convertedTypes || [...slot.card.types];
          if (!slot.convertedTypes.includes(newType)) {
            slot.convertedTypes.push(newType);
          }
        }
      });
    }
    
    // "Change all opponent's cards to [type]"
    match = desc.match(/change\s+all\s+opponent'?s?\s+cards?\s+to\s+(\w+)/);
    if (match) {
      const newType = match[1].toUpperCase();
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          slot.convertedTypes = slot.convertedTypes || [...slot.card.types];
          if (!slot.convertedTypes.includes(newType)) {
            slot.convertedTypes.push(newType);
          }
        }
      });
    }
    
    // "Change neighboring cards to [type]"
    match = desc.match(/change\s+neighboring\s+cards?\s+to\s+(\w+)/);
    if (match) {
      const newType = match[1].toUpperCase();
      neighbors.forEach(idx => {
        const neighbor = ownBoard[idx];
        if (neighbor && !neighbor.cancelled) {
          neighbor.convertedTypes = neighbor.convertedTypes || [...neighbor.card.types];
          if (!neighbor.convertedTypes.includes(newType)) {
            neighbor.convertedTypes.push(newType);
          }
        }
      });
    }
    
    // "Change opposite card to [type]"
    match = desc.match(/change\s+opposite\s+card\s+to\s+(\w+)(?:\s+type)?/);
    if (match) {
      const newType = match[1].toUpperCase();
      const opposite = enemyBoard[oppositeIdx];
      if (opposite && !opposite.cancelled) {
        opposite.convertedTypes = opposite.convertedTypes || [...opposite.card.types];
        if (!opposite.convertedTypes.includes(newType)) {
          opposite.convertedTypes.push(newType);
        }
      }
    }
    
    // "Change all your cards to [color]"
    match = desc.match(/change\s+all\s+(?:your\s+)?cards?\s+to\s+(\w+)(?:\s+color)?/);
    if (match && !desc.includes("opponent") && !desc.includes("type")) {
      const newColor = match[1].toUpperCase();
      ownBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          slot.convertedColors = [newColor];
        }
      });
    }
    
    // "Change all opponent's cards to [color]"
    match = desc.match(/change\s+all\s+opponent'?s?\s+cards?\s+to\s+(\w+)(?:\s+color)?/);
    if (match && !desc.includes("type")) {
      const newColor = match[1].toUpperCase();
      enemyBoard.forEach(slot => {
        if (slot && !slot.cancelled) {
          slot.convertedColors = [newColor];
        }
      });
    }
    
    // "Change neighboring cards to [color]"
    match = desc.match(/change\s+neighboring\s+cards?\s+to\s+(\w+)(?:\s+color)?/);
    if (match && !desc.includes("type")) {
      const newColor = match[1].toUpperCase();
      neighbors.forEach(idx => {
        const neighbor = ownBoard[idx];
        if (neighbor && !neighbor.cancelled) {
          neighbor.convertedColors = [newColor];
        }
      });
    }
    
    // "Change opposite card to [color]"
    match = desc.match(/change\s+opposite\s+card\s+to\s+(\w+)(?:\s+color)?/);
    if (match && !desc.includes("type")) {
      const newColor = match[1].toUpperCase();
      const opposite = enemyBoard[oppositeIdx];
      if (opposite && !opposite.cancelled) {
        opposite.convertedColors = [newColor];
      }
    }
    
    // "If [card] is in play, this card becomes a [type]"
    match = desc.match(/if\s+(.+?)\s+is\s+in\s+play[,;]?\s*this\s+card\s+becomes\s+(?:a\s+)?(\w+)/);
    if (match) {
      const requiredCard = match[1];
      const newType = match[2].toUpperCase();
      const allCards = [...ownBoard, ...enemyBoard];
      if (allCards.some(s => s && !s.cancelled && matchesTarget(s.card, requiredCard))) {
        sourceSlot.convertedTypes = sourceSlot.convertedTypes || [...sourceSlot.card.types];
        if (!sourceSlot.convertedTypes.includes(newType)) {
          sourceSlot.convertedTypes.push(newType);
        }
      }
    }
    
    // "Become a [type] if adjacent to a [type2]"
    match = desc.match(/become\s+(?:a\s+)?(\w+)\s+if\s+adjacent\s+to\s+(?:a\s+)?(\w+)/);
    if (match) {
      const newType = match[1].toUpperCase();
      const adjacentType = match[2];
      const hasAdjacent = neighbors.some(idx => {
        const neighbor = ownBoard[idx];
        return neighbor && !neighbor.cancelled && matchesTarget(neighbor.card, adjacentType);
      });
      if (hasAdjacent) {
        sourceSlot.convertedTypes = sourceSlot.convertedTypes || [...sourceSlot.card.types];
        if (!sourceSlot.convertedTypes.includes(newType)) {
          sourceSlot.convertedTypes.push(newType);
        }
      }
    }
    
    // "Switch positions with opposite card" (swap card content)
    if (desc.includes("switch") && desc.includes("opposite")) {
      const opposite = enemyBoard[oppositeIdx];
      if (opposite && !opposite.cancelled && !opposite.shielded) {
        // Swap card references
        const tempCard = sourceSlot.card;
        const tempModified = sourceSlot.modifiedPoints;
        sourceSlot.card = opposite.card;
        sourceSlot.modifiedPoints = opposite.card.basePoints;
        opposite.card = tempCard;
        opposite.modifiedPoints = tempCard.basePoints;
      }
    }
    
    // "Swap opposite card with a random card from opponent's deck"
    if (desc.includes("swap opposite") && desc.includes("deck")) {
      const opposite = enemyBoard[oppositeIdx];
      if (opposite && !opposite.cancelled && !opposite.shielded) {
        // This would require deck access - mark for visual effect
        (opposite as any).swappedWithDeck = true;
      }
    }
  };
  
  // Tenth pass: Apply deck/hand condition effects
  const applyDeckConditionEffects = (
    sourceSlot: PlacedCard,
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[],
    isPlayer: boolean,
    playerDeck: GameCard[]
  ) => {
    const desc = sourceSlot.card.description.toLowerCase();
    if (desc === "no power" || desc === "no powers") return;
    
    // "+X if your deck has 3 or more [type] cards"
    let match = desc.match(/\+(\d+)\s+if\s+(?:your\s+)?deck\s+has\s+(\d+)\s+or\s+more\s+(\w+)\s+cards?/);
    if (match) {
      const bonus = parseInt(match[1]);
      const requiredCount = parseInt(match[2]);
      const targetType = match[3];
      const typeCount = playerDeck.filter(c => matchesTarget(c, targetType)).length;
      if (typeCount >= requiredCount) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if this is the only [type] in your deck"
    match = desc.match(/\+(\d+)\s+if\s+this\s+is\s+(?:the\s+)?only\s+(\w+)\s+in\s+(?:your\s+)?deck/);
    if (match) {
      const bonus = parseInt(match[1]);
      const targetType = match[2];
      const typeCount = playerDeck.filter(c => matchesTarget(c, targetType)).length;
      if (typeCount === 1 && matchesTarget(sourceSlot.card, targetType)) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
    
    // "+X if you haven't played a [type] yet"
    match = desc.match(/\+(\d+)\s+if\s+(?:you\s+)?haven'?t\s+played\s+(?:a\s+)?(\w+)\s+yet/);
    if (match) {
      const bonus = parseInt(match[1]);
      const targetType = match[2];
      const playedTypes = ownBoard.filter(s => s && s.position < sourceSlot.position && matchesTarget(s.card, targetType));
      if (playedTypes.length === 0) {
        sourceSlot.modifiedPoints += bonus;
      }
    }
  };
  
  // Apply special effects
  allPlayerCards.forEach(slot => applySpecialEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applySpecialEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply round-specific effects
  allPlayerCards.forEach(slot => applyRoundEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyRoundEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply match-based effects
  allPlayerCards.forEach(slot => applyMatchBasedEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyMatchBasedEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply opponent-dependent effects
  allPlayerCards.forEach(slot => applyOpponentDependentEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyOpponentDependentEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply Slam effects
  allPlayerCards.forEach(slot => applySlamEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applySlamEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply transform effects
  allPlayerCards.forEach(slot => applyTransformEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyTransformEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply deck condition effects
  allPlayerCards.forEach(slot => applyDeckConditionEffects(slot, playerBoard, opponentBoard, true, state.player.deck));
  allOpponentCards.forEach(slot => applyDeckConditionEffects(slot, opponentBoard, playerBoard, false, state.opponent.deck));
  
  // Apply final effects (like Dende)
  allPlayerCards.forEach(slot => applyFinalEffects(slot, playerBoard, true));
  allOpponentCards.forEach(slot => applyFinalEffects(slot, opponentBoard, false));
  
  // Ensure no negative points (except where explicitly handled)
  playerBoard.forEach(slot => {
    if (slot) slot.modifiedPoints = Math.max(0, slot.modifiedPoints);
  });
  opponentBoard.forEach(slot => {
    if (slot) slot.modifiedPoints = Math.max(0, slot.modifiedPoints);
  });
  
  return {
    ...state,
    player: { ...state.player, board: playerBoard },
    opponent: { ...state.opponent, board: opponentBoard },
  };
}

export function calculateScores(state: GameState): GameState {
  // First, build color overrides based on "Treats as [Color]" effects
  const buildColorOverrides = (
    ownBoard: (PlacedCard | null)[],
    enemyBoard: (PlacedCard | null)[]
  ): Map<number, string[]> => {
    const overrides = new Map<number, string[]>(); // position -> colors to add
    
    ownBoard.forEach((slot, pos) => {
      if (!slot || slot.cancelled) return;
      const desc = slot.card.description.toLowerCase();
      
      // "Treats opposing card as [Color]" - treat opposite card as a color
      let match = desc.match(/treats?\s+oppos(?:ing|ite)\s+card\s+as\s+(\w+)/);
      if (match) {
        const color = match[1].toUpperCase();
        const oppositeSlot = enemyBoard[pos];
        if (oppositeSlot && !oppositeSlot.cancelled) {
          // Mark the opposite card to be counted as this color for enemy's scoring
          const existing = overrides.get(pos) || [];
          existing.push(color);
          overrides.set(pos, existing);
        }
      }
      
      // "Treats neighboring cards as [Color]" - Green Lantern effect
      match = desc.match(/treats?\s+neighboring\s+cards?\s+as\s+(\w+)/);
      if (match) {
        const color = match[1].toUpperCase();
        const neighbors = getNeighborIndices(pos);
        neighbors.forEach(nIdx => {
          const neighbor = ownBoard[nIdx];
          if (neighbor && !neighbor.cancelled) {
            const existing = overrides.get(nIdx) || [];
            existing.push(color);
            overrides.set(nIdx, existing);
          }
        });
      }
    });
    
    return overrides;
  };
  
  const playerColorOverrides = buildColorOverrides(state.player.board, state.opponent.board);
  const opponentColorOverrides = buildColorOverrides(state.opponent.board, state.player.board);
  // Note: "Treats opposing card as X" makes the ENEMY card count as X for the ENEMY's color count
  // This needs special handling - the player's effect affects opponent's scoring
  const playerToOpponentOverrides = new Map<number, string[]>();
  const opponentToPlayerOverrides = new Map<number, string[]>();
  
  state.player.board.forEach((slot, pos) => {
    if (!slot || slot.cancelled) return;
    const desc = slot.card.description.toLowerCase();
    const match = desc.match(/treats?\s+oppos(?:ing|ite)\s+card\s+as\s+(\w+)/);
    if (match) {
      const color = match[1].toUpperCase();
      const existing = playerToOpponentOverrides.get(pos) || [];
      existing.push(color);
      playerToOpponentOverrides.set(pos, existing);
    }
  });
  
  state.opponent.board.forEach((slot, pos) => {
    if (!slot || slot.cancelled) return;
    const desc = slot.card.description.toLowerCase();
    const match = desc.match(/treats?\s+oppos(?:ing|ite)\s+card\s+as\s+(\w+)/);
    if (match) {
      const color = match[1].toUpperCase();
      const existing = opponentToPlayerOverrides.get(pos) || [];
      existing.push(color);
      opponentToPlayerOverrides.set(pos, existing);
    }
  });
  
  const calcForPlayer = (
    board: (PlacedCard | null)[], 
    mainColors: string[],
    neighborOverrides: Map<number, string[]>,
    enemyOverrides: Map<number, string[]>
  ) => {
    let totalPoints = 0;
    const colorCounts: Record<string, number> = {};
    
    mainColors.forEach(c => colorCounts[c] = 0);
    
    board.forEach((slot, pos) => {
      if (!slot || slot.cancelled) return;
      totalPoints += slot.modifiedPoints;
      
      // Check if card counts as all colors
      if (slot.countsAsAllColors) {
        mainColors.forEach(color => {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
        return;
      }
      
      // Get colors - use converted colors if they exist, otherwise base colors
      const colors = new Set(slot.convertedColors || slot.card.colors);
      
      // Add colors from neighbor effects (like Green Lantern)
      const neighborAddedColors = neighborOverrides.get(pos) || [];
      neighborAddedColors.forEach(c => colors.add(c));
      
      // Add colors from enemy "Treats opposing as" effects
      const enemyAddedColors = enemyOverrides.get(pos) || [];
      enemyAddedColors.forEach(c => colors.add(c));
      
      colors.forEach(color => {
        if (mainColors.includes(color)) {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
      });
    });
    
    return { totalPoints, colorCounts };
  };
  
  const playerScores = calcForPlayer(
    state.player.board, 
    state.mainColors,
    playerColorOverrides,
    opponentToPlayerOverrides
  );
  const opponentScores = calcForPlayer(
    state.opponent.board, 
    state.mainColors,
    opponentColorOverrides,
    playerToOpponentOverrides
  );
  
  return {
    ...state,
    player: { ...state.player, ...playerScores },
    opponent: { ...state.opponent, ...opponentScores },
  };
}

export function determineWinner(state: GameState): GameState {
  const { player, opponent } = state;
  
  // Check for reverse scoring effect
  let reverseScoring = state.reverseScoring || false;
  [...state.player.board, ...state.opponent.board].forEach(slot => {
    if (slot && !slot.cancelled && (slot as any).triggersReverseScoring) {
      reverseScoring = true;
    }
  });
  
  // Check for color condition changes
  let effectiveMainColors = state.overrideMainColors || state.mainColors;
  [...state.player.board, ...state.opponent.board].forEach(slot => {
    if (slot && !slot.cancelled && (slot as any).changesColorConditionTo) {
      const newColor = (slot as any).changesColorConditionTo;
      effectiveMainColors = [newColor];
    }
  });
  
  if (effectiveMainColors.length >= 2) {
    let playerWinsAllColors = true;
    let opponentWinsAllColors = true;
    
    for (const color of effectiveMainColors) {
      if ((player.colorCounts[color] || 0) <= (opponent.colorCounts[color] || 0)) {
        playerWinsAllColors = false;
      }
      if ((opponent.colorCounts[color] || 0) <= (player.colorCounts[color] || 0)) {
        opponentWinsAllColors = false;
      }
    }
    
    if (playerWinsAllColors) {
      return { ...state, winner: "player", winMethod: "color" };
    }
    if (opponentWinsAllColors) {
      return { ...state, winner: "opponent", winMethod: "color" };
    }
  }
  
  // Points comparison - respect reverse scoring
  if (reverseScoring) {
    // Lowest total wins
    if (player.totalPoints < opponent.totalPoints) {
      return { ...state, winner: "player", winMethod: "points", reverseScoring: true };
    } else if (opponent.totalPoints < player.totalPoints) {
      return { ...state, winner: "opponent", winMethod: "points", reverseScoring: true };
    }
  } else {
    // Normal scoring - highest total wins
    if (player.totalPoints > opponent.totalPoints) {
      return { ...state, winner: "player", winMethod: "points" };
    } else if (opponent.totalPoints > player.totalPoints) {
      return { ...state, winner: "opponent", winMethod: "points" };
    }
  }
  
  return { ...state, winner: "tie", winMethod: "points" };
}

export function refillHand(state: GameState): GameState {
  const refill = (playerState: PlayerState): PlayerState => {
    const usedCardIds = new Set([
      ...playerState.hand.map(c => c.id),
      ...playerState.board.filter((s): s is PlacedCard => s !== null).map(s => s.card.id),
    ]);
    
    const remaining = playerState.deck.filter(c => !usedCardIds.has(c.id));
    const needed = 6 - playerState.hand.length;
    const newCards = remaining.slice(0, needed);
    
    return {
      ...playerState,
      hand: [...playerState.hand, ...newCards],
    };
  };
  
  return {
    ...state,
    player: refill(state.player),
    opponent: refill(state.opponent),
  };
}

// Gambling effect types for animation
export interface GamblingEffectResult {
  cardTitle: string;
  cardPosition: number;
  isPlayer: boolean;
  effectType: "coin" | "dice" | "double-dice";
  outcome: number | "heads" | "tails";
  secondDie?: number;
  pointChange: number;
  isPositive: boolean;
  effectDescription: string;
  specialEffect?: "cancel" | "cancel-all" | "cancel-opposite";
}

// Detect if a card has a gambling effect
export function hasGamblingEffect(description: string): boolean {
  const desc = description.toLowerCase();
  return (
    desc.includes("coin flip") ||
    desc.includes("dice roll") ||
    desc.includes("roll 2 dice") ||
    desc.includes("randomly gain") ||
    desc.includes("lucky 7") ||
    desc.includes("snake eyes") ||
    desc.includes("boxcars") ||
    desc.includes("all-in")
  );
}

// Process a gambling effect and return the result
export function processGamblingEffectForCard(
  card: PlacedCard,
  isPlayer: boolean
): GamblingEffectResult | null {
  const desc = card.card.description.toLowerCase();
  const basePoints = card.card.basePoints;

  // Coin flip: +X or -X
  let match = desc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+-(\d+)/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const loseAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : -loseAmount,
      isPositive: isHeads,
      effectDescription: `Coin flip: +${winAmount} or -${loseAmount}`,
    };
  }

  // Coin flip: double or zero
  if (desc.includes("coin flip") && desc.includes("double") && desc.includes("zero")) {
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints : -basePoints,
      isPositive: isHeads,
      effectDescription: "Coin flip: x2 or x0",
    };
  }

  // Coin flip: +X or cancel
  match = desc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+cancel/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : 0,
      isPositive: isHeads,
      effectDescription: `Coin flip: +${winAmount} or cancel`,
      specialEffect: isHeads ? undefined : "cancel",
    };
  }

  // Coin flip: steal or give
  match = desc.match(/coin\s*flip:\s*steal\s*(\d+)\s*.+\s*give\s*(\d+)/);
  if (match) {
    const stealAmount = parseInt(match[1]);
    const giveAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? stealAmount : -giveAmount,
      isPositive: isHeads,
      effectDescription: `Coin flip: steal ${stealAmount} or give ${giveAmount}`,
    };
  }

  // Coin flip: buff or debuff team
  match = desc.match(/coin\s*flip:\s*\+(\d+)\s+to\s+all.+or\s+-(\d+)\s+to\s+all/);
  if (match) {
    const buffAmount = parseInt(match[1]);
    const debuffAmount = parseInt(match[2]);
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? buffAmount : -debuffAmount,
      isPositive: isHeads,
      effectDescription: `Team buff/debuff: ${isHeads ? '+' : '-'}${isHeads ? buffAmount : debuffAmount} to all`,
    };
  }

  // Dice roll: +1 to +6
  if (desc.includes("dice roll") && desc.includes("+1 to +6")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      effectDescription: "Dice roll: +1 to +6",
    };
  }

  // Dice roll: -3 to +6
  if (desc.includes("dice roll") && desc.includes("-3 to +6")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const change = roll <= 3 ? -(4 - roll) : roll - 3;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: change > 0,
      effectDescription: "Risky dice: -3 to +3",
    };
  }

  // Dice roll: multiplier
  if (desc.includes("dice roll") && desc.includes("multiply")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const multipliers = [0, 0.5, 1, 1.5, 2, 3];
    const mult = multipliers[roll - 1];
    const change = Math.floor(basePoints * mult) - basePoints;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: mult >= 1,
      effectDescription: `Multiplier roll: x${mult}`,
    };
  }

  // Dice roll: effect roulette
  if (desc.includes("dice roll") && desc.includes("1=cancel")) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const effects = [0, -5, 0, 3, 6, 10];
    const change = effects[roll - 1];
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll === 1 ? 0 : change,
      isPositive: change > 0,
      effectDescription: "Effect roulette",
      specialEffect: roll === 1 ? "cancel" : undefined,
    };
  }

  // Lucky 7
  if (desc.includes("roll 2 dice") && desc.includes("7")) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: total === 7 ? 15 : -3,
      isPositive: total === 7,
      effectDescription: `Lucky 7: ${die1} + ${die2} = ${total}`,
    };
  }

  // Snake Eyes
  if (desc.includes("snake eyes") || (desc.includes("double 1s") && desc.includes("cancel"))) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const isSnakeEyes = die1 === 1 && die2 === 1;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: 0,
      isPositive: isSnakeEyes,
      effectDescription: isSnakeEyes ? "SNAKE EYES! Cancel opposite!" : `${die1} + ${die2} - No effect`,
      specialEffect: isSnakeEyes ? "cancel-opposite" : undefined,
    };
  }

  // Boxcars
  if (desc.includes("boxcars") || (desc.includes("double 6s") && desc.includes("+20"))) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const isBoxcars = die1 === 6 && die2 === 6;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: isBoxcars ? 20 : -(die1 + die2),
      isPositive: isBoxcars,
      effectDescription: isBoxcars ? "BOXCARS! +20!" : `${die1} + ${die2} = -${die1 + die2}`,
    };
  }

  // All-In Flip
  if (desc.includes("all-in") || (desc.includes("x3") && desc.includes("cancel all"))) {
    const isHeads = Math.random() < 0.5;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints * 2 : 0,
      isPositive: isHeads,
      effectDescription: isHeads ? "ALL-IN WINS! x3!" : "ALL-IN LOSES! All cards cancelled!",
      specialEffect: isHeads ? undefined : "cancel-all",
    };
  }

  // Double dice: difference
  if (desc.includes("roll 2 dice") && desc.includes("difference")) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const diff = Math.abs(die1 - die2);
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: diff,
      isPositive: diff > 0,
      effectDescription: `Dice difference: |${die1} - ${die2}| = ${diff}`,
    };
  }

  // Random +X to +Y
  match = desc.match(/randomly\s+gain\s+\+(\d+)\s+to\s+\+(\d+)/);
  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const roll = Math.floor(Math.random() * (max - min + 1)) + min;
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      effectDescription: `Random: +${roll}`,
    };
  }

  return null;
}

// Get all gambling effects for a game state
export function getGamblingEffects(state: GameState): GamblingEffectResult[] {
  const results: GamblingEffectResult[] = [];
  
  state.player.board.forEach(slot => {
    if (slot && !slot.cancelled && hasGamblingEffect(slot.card.description)) {
      const result = processGamblingEffectForCard(slot, true);
      if (result) results.push(result);
    }
  });
  
  state.opponent.board.forEach(slot => {
    if (slot && !slot.cancelled && hasGamblingEffect(slot.card.description)) {
      const result = processGamblingEffectForCard(slot, false);
      if (result) results.push(result);
    }
  });
  
  return results;
}

// Seeded version of processGamblingEffectForCard for PvP mode
// Uses deterministic random based on matchId to ensure both players see same results
export function processGamblingEffectForCardSeeded(
  card: PlacedCard,
  isPlayer: boolean,
  matchId: string,
  round: number
): GamblingEffectResult | null {
  const desc = card.card.description.toLowerCase();
  const basePoints = card.card.basePoints;
  const position = card.position;

  // Coin flip: +X or -X
  let match = desc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+-(\d+)/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const loseAmount = parseInt(match[2]);
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : -loseAmount,
      isPositive: isHeads,
      effectDescription: `Coin flip: +${winAmount} or -${loseAmount}`,
    };
  }

  // Coin flip: double or zero
  if (desc.includes("coin flip") && desc.includes("double") && desc.includes("zero")) {
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints : -basePoints,
      isPositive: isHeads,
      effectDescription: "Coin flip: x2 or x0",
    };
  }

  // Coin flip: +X or cancel
  match = desc.match(/coin\s*flip:\s*\+(\d+)\s+or\s+cancel/);
  if (match) {
    const winAmount = parseInt(match[1]);
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? winAmount : 0,
      isPositive: isHeads,
      effectDescription: `Coin flip: +${winAmount} or cancel`,
      specialEffect: isHeads ? undefined : "cancel",
    };
  }

  // Coin flip: steal or give
  match = desc.match(/coin\s*flip:\s*steal\s*(\d+)\s*.+\s*give\s*(\d+)/);
  if (match) {
    const stealAmount = parseInt(match[1]);
    const giveAmount = parseInt(match[2]);
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? stealAmount : -giveAmount,
      isPositive: isHeads,
      effectDescription: `Coin flip: steal ${stealAmount} or give ${giveAmount}`,
    };
  }

  // Coin flip: buff or debuff team
  match = desc.match(/coin\s*flip:\s*\+(\d+)\s+to\s+all.+or\s+-(\d+)\s+to\s+all/);
  if (match) {
    const buffAmount = parseInt(match[1]);
    const debuffAmount = parseInt(match[2]);
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? buffAmount : -debuffAmount,
      isPositive: isHeads,
      effectDescription: `Team buff/debuff: ${isHeads ? '+' : '-'}${isHeads ? buffAmount : debuffAmount} to all`,
    };
  }

  // Dice roll: +1 to +6
  if (desc.includes("dice roll") && desc.includes("+1 to +6")) {
    const roll = seededDiceRoll(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      effectDescription: "Dice roll: +1 to +6",
    };
  }

  // Dice roll: -3 to +6
  if (desc.includes("dice roll") && desc.includes("-3 to +6")) {
    const roll = seededDiceRoll(matchId, position, round);
    const change = roll <= 3 ? -(4 - roll) : roll - 3;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: change > 0,
      effectDescription: "Risky dice: -3 to +3",
    };
  }

  // Dice roll: multiplier
  if (desc.includes("dice roll") && desc.includes("multiply")) {
    const roll = seededDiceRoll(matchId, position, round);
    const multipliers = [0, 0.5, 1, 1.5, 2, 3];
    const mult = multipliers[roll - 1];
    const change = Math.floor(basePoints * mult) - basePoints;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: change,
      isPositive: mult >= 1,
      effectDescription: `Multiplier roll: x${mult}`,
    };
  }

  // Dice roll: effect roulette
  if (desc.includes("dice roll") && desc.includes("1=cancel")) {
    const roll = seededDiceRoll(matchId, position, round);
    const effects = [0, -5, 0, 3, 6, 10];
    const change = effects[roll - 1];
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll === 1 ? 0 : change,
      isPositive: change > 0,
      effectDescription: "Effect roulette",
      specialEffect: roll === 1 ? "cancel" : undefined,
    };
  }

  // Lucky 7
  if (desc.includes("roll 2 dice") && desc.includes("7")) {
    const die1 = seededDiceRoll(matchId, position, round, 0);
    const die2 = seededDiceRoll(matchId, position, round, 1);
    const total = die1 + die2;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: total === 7 ? 15 : -3,
      isPositive: total === 7,
      effectDescription: `Lucky 7: ${die1} + ${die2} = ${total}`,
    };
  }

  // Snake Eyes
  if (desc.includes("snake eyes") || (desc.includes("double 1s") && desc.includes("cancel"))) {
    const die1 = seededDiceRoll(matchId, position, round, 0);
    const die2 = seededDiceRoll(matchId, position, round, 1);
    const isSnakeEyes = die1 === 1 && die2 === 1;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: 0,
      isPositive: isSnakeEyes,
      effectDescription: isSnakeEyes ? "SNAKE EYES! Cancel opposite!" : `${die1} + ${die2} - No effect`,
      specialEffect: isSnakeEyes ? "cancel-opposite" : undefined,
    };
  }

  // Boxcars
  if (desc.includes("boxcars") || (desc.includes("double 6s") && desc.includes("+20"))) {
    const die1 = seededDiceRoll(matchId, position, round, 0);
    const die2 = seededDiceRoll(matchId, position, round, 1);
    const isBoxcars = die1 === 6 && die2 === 6;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: isBoxcars ? 20 : -(die1 + die2),
      isPositive: isBoxcars,
      effectDescription: isBoxcars ? "BOXCARS! +20!" : `${die1} + ${die2} = -${die1 + die2}`,
    };
  }

  // All-In Flip
  if (desc.includes("all-in") || (desc.includes("x3") && desc.includes("cancel all"))) {
    const isHeads = seededCoinFlip(matchId, position, round);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "coin",
      outcome: isHeads ? "heads" : "tails",
      pointChange: isHeads ? basePoints * 2 : 0,
      isPositive: isHeads,
      effectDescription: isHeads ? "ALL-IN WINS! x3!" : "ALL-IN LOSES! All cards cancelled!",
      specialEffect: isHeads ? undefined : "cancel-all",
    };
  }

  // Double dice: difference
  if (desc.includes("roll 2 dice") && desc.includes("difference")) {
    const die1 = seededDiceRoll(matchId, position, round, 0);
    const die2 = seededDiceRoll(matchId, position, round, 1);
    const diff = Math.abs(die1 - die2);
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "double-dice",
      outcome: die1,
      secondDie: die2,
      pointChange: diff,
      isPositive: diff > 0,
      effectDescription: `Dice difference: |${die1} - ${die2}| = ${diff}`,
    };
  }

  // Random +X to +Y
  match = desc.match(/randomly\s+gain\s+\+(\d+)\s+to\s+\+(\d+)/);
  if (match) {
    const min = parseInt(match[1]);
    const max = parseInt(match[2]);
    const random = getSeededGamblingRandom(matchId, position, round);
    const roll = Math.floor(random * (max - min + 1)) + min;
    return {
      cardTitle: card.card.title,
      cardPosition: position,
      isPlayer,
      effectType: "dice",
      outcome: roll,
      pointChange: roll,
      isPositive: true,
      effectDescription: `Random: +${roll}`,
    };
  }

  return null;
}

// Get all gambling effects for a game state with seeded random (for PvP)
export function getGamblingEffectsSeeded(
  state: GameState,
  matchId: string,
  round: number
): GamblingEffectResult[] {
  const results: GamblingEffectResult[] = [];
  
  state.player.board.forEach(slot => {
    if (slot && !slot.cancelled && hasGamblingEffect(slot.card.description)) {
      const result = processGamblingEffectForCardSeeded(slot, true, matchId, round);
      if (result) results.push(result);
    }
  });
  
  state.opponent.board.forEach(slot => {
    if (slot && !slot.cancelled && hasGamblingEffect(slot.card.description)) {
      const result = processGamblingEffectForCardSeeded(slot, false, matchId, round);
      if (result) results.push(result);
    }
  });
  
  return results;
}

// Apply a gambling effect result to the game state
export function applyGamblingResult(
  state: GameState,
  result: GamblingEffectResult
): GameState {
  const newState = { ...state };
  const board = result.isPlayer 
    ? [...newState.player.board] 
    : [...newState.opponent.board];
  const enemyBoard = result.isPlayer 
    ? [...newState.opponent.board] 
    : [...newState.player.board];
  
  const slot = board[result.cardPosition];
  if (!slot) return state;
  
  // Apply point change
  slot.modifiedPoints += result.pointChange;
  
  // Apply special effects
  if (result.specialEffect === "cancel") {
    slot.cancelled = true;
  } else if (result.specialEffect === "cancel-all") {
    board.forEach(s => {
      if (s && !s.shielded) s.cancelled = true;
    });
  } else if (result.specialEffect === "cancel-opposite") {
    const opposite = enemyBoard[result.cardPosition];
    if (opposite && !opposite.shielded) {
      opposite.cancelled = true;
    }
  }
  
  // Update state
  if (result.isPlayer) {
    newState.player = { ...newState.player, board };
    newState.opponent = { ...newState.opponent, board: enemyBoard };
  } else {
    newState.opponent = { ...newState.opponent, board };
    newState.player = { ...newState.player, board: enemyBoard };
  }
  
  return newState;
}

// Choice effect types
export interface ChoiceEffectResult {
  cardTitle: string;
  cardPosition: number;
  isPlayer: boolean;
  effectType: string;
  options: ChoiceOption[];
}

export interface ChoiceOption {
  label: string;
  description: string;
  value: string;
  icon?: "buff" | "debuff" | "special" | "cancel";
}

// Check if a card has a choice effect
export function hasChoiceEffect(description: string): boolean {
  const desc = description.toLowerCase();
  return desc.includes("choose one:") || desc.includes("activate one:");
}

// Parse a choice effect from card description
export function parseChoiceEffect(
  card: PlacedCard,
  isPlayer: boolean
): ChoiceEffectResult | null {
  const desc = card.card.description.toLowerCase();
  
  // "Choose one: +X or +Y for each [type]"
  let match = desc.match(/choose\s+one:\s*\+(\d+)\s+or\s+\+(\d+)\s+for\s+each\s+(.+?)(?:\s+in\s+play)?$/);
  if (match) {
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "choose-bonus-or-scaling",
      options: [
        {
          label: `+${match[1]} Points`,
          description: "Add flat bonus to this card",
          value: `flat:${match[1]}`,
          icon: "buff",
        },
        {
          label: `+${match[2]} per ${match[3]}`,
          description: `Gain +${match[2]} for each ${match[3]} in play`,
          value: `scaling:${match[2]}:${match[3]}`,
          icon: "special",
        },
      ],
    };
  }

  // "Choose one: +X to this card or -X to opposite"
  match = desc.match(/choose\s+one:\s*\+(\d+)\s+to\s+this\s+card\s+or\s+-(\d+)\s+to\s+opposite/);
  if (match) {
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "choose-buff-or-debuff",
      options: [
        {
          label: `+${match[1]} to Self`,
          description: "Buff this card's points",
          value: `self:${match[1]}`,
          icon: "buff",
        },
        {
          label: `-${match[2]} to Opposite`,
          description: "Debuff the opposing card",
          value: `opposite:-${match[2]}`,
          icon: "debuff",
        },
      ],
    };
  }

  // "Choose one: cancel opposite or double this card"
  if (desc.includes("choose one") && desc.includes("cancel") && desc.includes("double")) {
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "choose-cancel-or-double",
      options: [
        {
          label: "Cancel Opposite",
          description: "Nullify the opposing card entirely",
          value: "cancel-opposite",
          icon: "cancel",
        },
        {
          label: "Double Points",
          description: "Double this card's current points",
          value: "double-self",
          icon: "buff",
        },
      ],
    };
  }

  // "Choose one: +X to neighbors or +Y to all [type]"
  match = desc.match(/choose\s+one:\s*\+(\d+)\s+to\s+neighbors\s+or\s+\+(\d+)\s+to\s+all\s+(.+)/);
  if (match) {
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "choose-neighbor-or-type",
      options: [
        {
          label: `+${match[1]} to Neighbors`,
          description: "Buff adjacent cards",
          value: `neighbors:${match[1]}`,
          icon: "buff",
        },
        {
          label: `+${match[2]} to all ${match[3]}`,
          description: `Buff all ${match[3]} cards`,
          value: `type:${match[2]}:${match[3]}`,
          icon: "special",
        },
      ],
    };
  }

  // Generic "Activate one:" pattern
  match = desc.match(/activate\s+one:\s*(.+?)\s+or\s+(.+)/);
  if (match) {
    return {
      cardTitle: card.card.title,
      cardPosition: card.position,
      isPlayer,
      effectType: "choose-generic",
      options: [
        {
          label: "Option A",
          description: match[1],
          value: `optionA:${match[1]}`,
          icon: "special",
        },
        {
          label: "Option B",
          description: match[2],
          value: `optionB:${match[2]}`,
          icon: "special",
        },
      ],
    };
  }

  return null;
}

// Get all choice effects for a game state
export function getChoiceEffects(state: GameState): ChoiceEffectResult[] {
  const results: ChoiceEffectResult[] = [];
  
  state.player.board.forEach(slot => {
    if (slot && !slot.cancelled && !slot.choiceResolved && hasChoiceEffect(slot.card.description)) {
      const result = parseChoiceEffect(slot, true);
      if (result) results.push(result);
    }
  });
  
  // For CPU, we auto-resolve choices
  state.opponent.board.forEach(slot => {
    if (slot && !slot.cancelled && !slot.choiceResolved && hasChoiceEffect(slot.card.description)) {
      // CPU automatically picks the first option
      slot.choiceResolved = true;
      slot.chosenEffect = "auto";
    }
  });
  
  return results;
}

// Apply a choice effect result to the game state
export function applyChoiceResult(
  state: GameState,
  position: number,
  isPlayer: boolean,
  choice: string
): GameState {
  const newState = { ...state };
  const board = isPlayer 
    ? [...newState.player.board] 
    : [...newState.opponent.board];
  const enemyBoard = isPlayer 
    ? [...newState.opponent.board] 
    : [...newState.player.board];
  
  const slot = board[position];
  if (!slot) return state;
  
  slot.choiceResolved = true;
  slot.chosenEffect = choice;
  
  // Parse and apply the choice
  if (choice.startsWith("flat:")) {
    const bonus = parseInt(choice.split(":")[1]);
    slot.modifiedPoints += bonus;
  } else if (choice.startsWith("scaling:")) {
    const parts = choice.split(":");
    const bonusPer = parseInt(parts[1]);
    const targetType = parts[2];
    const allCards = [...board, ...enemyBoard].filter((s): s is PlacedCard => s !== null && !s.cancelled);
    const count = allCards.filter(c => matchesTarget(c.card, targetType)).length;
    slot.modifiedPoints += bonusPer * count;
  } else if (choice.startsWith("self:")) {
    const bonus = parseInt(choice.split(":")[1]);
    slot.modifiedPoints += bonus;
  } else if (choice.startsWith("opposite:")) {
    const penalty = parseInt(choice.split(":")[1]);
    const opposite = enemyBoard[position];
    if (opposite && !opposite.cancelled && !opposite.shielded) {
      opposite.modifiedPoints += penalty; // penalty is already negative
    }
  } else if (choice === "cancel-opposite") {
    const opposite = enemyBoard[position];
    if (opposite && !opposite.cancelled && !opposite.shielded) {
      opposite.cancelled = true;
    }
  } else if (choice === "double-self") {
    slot.modifiedPoints *= 2;
  } else if (choice.startsWith("neighbors:")) {
    const bonus = parseInt(choice.split(":")[1]);
    const neighbors = getNeighborIndices(position);
    neighbors.forEach(idx => {
      const neighbor = board[idx];
      if (neighbor && !neighbor.cancelled) {
        neighbor.modifiedPoints += bonus;
      }
    });
  } else if (choice.startsWith("type:")) {
    const parts = choice.split(":");
    const bonus = parseInt(parts[1]);
    const targetType = parts[2];
    board.forEach(s => {
      if (s && !s.cancelled && matchesTarget(s.card, targetType)) {
        s.modifiedPoints += bonus;
      }
    });
  }
  
  // Update state
  if (isPlayer) {
    newState.player = { ...newState.player, board };
    newState.opponent = { ...newState.opponent, board: enemyBoard };
  } else {
    newState.opponent = { ...newState.opponent, board };
    newState.player = { ...newState.player, board: enemyBoard };
  }
  
  return newState;
}

// Store round 1 scores for round 2 effects
export function storeRound1Scores(state: GameState): GameState {
  const playerScore = state.player.board
    .filter((s): s is PlacedCard => s !== null && !s.cancelled && s.position < 4)
    .reduce((sum, s) => sum + s.modifiedPoints, 0);
  
  const opponentScore = state.opponent.board
    .filter((s): s is PlacedCard => s !== null && !s.cancelled && s.position < 4)
    .reduce((sum, s) => sum + s.modifiedPoints, 0);
  
  return {
    ...state,
    round1PlayerScore: playerScore,
    round1OpponentScore: opponentScore,
  };
}

// Get effective types for a card (including converted types)
export function getEffectiveTypes(card: PlacedCard): string[] {
  return card.convertedTypes || card.card.types;
}

// Get effective colors for a card (including converted colors)
export function getEffectiveColors(card: PlacedCard): string[] {
  return card.convertedColors || card.card.colors;
}