import cardsData from "@/data/cards.json";

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
  
  // Apply special effects
  allPlayerCards.forEach(slot => applySpecialEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applySpecialEffects(slot, opponentBoard, playerBoard, false));
  
  // Apply round-specific effects
  allPlayerCards.forEach(slot => applyRoundEffects(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyRoundEffects(slot, opponentBoard, playerBoard, false));
  
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
      
      // Get base colors
      const colors = new Set(slot.card.colors);
      
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
  const { player, opponent, mainColors } = state;
  
  if (mainColors.length >= 2) {
    let playerWinsAllColors = true;
    let opponentWinsAllColors = true;
    
    for (const color of mainColors) {
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
  
  if (player.totalPoints > opponent.totalPoints) {
    return { ...state, winner: "player", winMethod: "points" };
  } else if (opponent.totalPoints > player.totalPoints) {
    return { ...state, winner: "opponent", winMethod: "points" };
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