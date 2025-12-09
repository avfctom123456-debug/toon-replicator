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
        if (playerBoard[i]) playerBoard[i] = { ...playerBoard[i]!, cancelled: true };
      });
    }
  }
  
  for (const char in opponentCharacters) {
    if (opponentCharacters[char].length > 1) {
      opponentCharacters[char].forEach(i => {
        if (opponentBoard[i]) opponentBoard[i] = { ...opponentBoard[i]!, cancelled: true };
      });
    }
  }
  
  for (const char in playerCharacters) {
    if (opponentCharacters[char]) {
      playerCharacters[char].forEach(i => {
        if (playerBoard[i]) playerBoard[i] = { ...playerBoard[i]!, cancelled: true };
      });
      opponentCharacters[char].forEach(i => {
        if (opponentBoard[i]) opponentBoard[i] = { ...opponentBoard[i]!, cancelled: true };
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

function matchesTarget(card: GameCard, target: string): boolean {
  const lowerTarget = target.toLowerCase();
  
  // Check character name
  if (card.character.toLowerCase().includes(lowerTarget)) return true;
  
  // Check types
  if (card.types.some(t => t.toLowerCase() === lowerTarget)) return true;
  
  // Check groups
  if (card.groups.some(g => g.toLowerCase().includes(lowerTarget))) return true;
  
  // Special checks
  if (lowerTarget === "hero" && card.types.includes("HERO")) return true;
  if (lowerTarget === "villain" && card.types.includes("VILLAIN")) return true;
  if (lowerTarget === "animal" && card.types.includes("ANIMAL")) return true;
  if (lowerTarget === "female" && card.types.includes("FEMALE")) return true;
  if (lowerTarget === "male" && card.types.includes("MALE")) return true;
  if (lowerTarget === "monster" && card.types.includes("MONSTER")) return true;
  if (lowerTarget === "prop" && card.types.includes("PROP")) return true;
  if (lowerTarget === "vehicle" && card.types.includes("VEHICLE")) return true;
  
  // Check for group membership
  if (lowerTarget.includes("justice league") && card.groups.includes("JUSTICE LEAGUE")) return true;
  if (lowerTarget.includes("teen titan") && card.groups.includes("TEEN TITANS")) return true;
  if (lowerTarget.includes("powerpuff") && card.groups.includes("POWERPUFF GIRLS")) return true;
  
  return false;
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
      // "+X if any [character] is in play"
      let match = effect.match(/\+(\d+)\s+if\s+(?:any\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints += bonus;
        }
        continue;
      }
      
      // "+X if [character] is in play" (without "any")
      match = effect.match(/\+(\d+)\s+if\s+(.+?)\s+is\s+in\s+play/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints += bonus;
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
      
      // "x2 if [character] is in play"
      match = effect.match(/x2\s+if\s+(?:the\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const target = match[1];
        if (allActiveCards.some(c => matchesTarget(c.card, target))) {
          slot.modifiedPoints *= 2;
        }
        continue;
      }
      
      // "+X for each [type] in play"
      match = effect.match(/\+(\d+)\s+for\s+each\s+(?:opponent\s+)?(.+?)(?:\s+in\s+play)?$/);
      if (match) {
        const bonus = parseInt(match[1]);
        const target = match[2];
        const isOpponentOnly = effect.includes("opponent");
        const searchCards = isOpponentOnly ? allOpponentCards : allActiveCards;
        const count = searchCards.filter(c => matchesTarget(c.card, target) || hasColor(c.card, target)).length;
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
      // "+X to all [color] cards"
      let match = effect.match(/\+(\d+)\s+to\s+all\s+(?:other\s+)?(.+?)\s+cards?/);
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
      
      // "+X to any [character/type]" or "+X to [character]"
      match = effect.match(/\+(\d+)\s+to\s+(?:any\s+)?(.+?)(?:;|$)/);
      if (match && !effect.includes("all")) {
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
      
      // "-X to opposing card if not a [type]"
      match = effect.match(/-(\d+)\s+to\s+oppos(?:ing|ite)\s+card\s+if\s+not\s+(?:a|an)\s+(.+)/);
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
      
      // "x2 to [target] if [condition] is in play"
      match = effect.match(/x2\s+to\s+(.+?)\s+if\s+(?:the\s+)?(.+?)\s+is\s+in\s+play/);
      if (match) {
        const target = match[1];
        const condition = match[2];
        if (allActiveCards.some(c => matchesTarget(c.card, condition))) {
          ownBoard.forEach(slot => {
            if (slot && !slot.cancelled && matchesTarget(slot.card, target)) {
              slot.modifiedPoints *= 2;
            }
          });
        }
        continue;
      }
    }
  };
  
  // Apply buffs/debuffs
  allPlayerCards.forEach(slot => applyBuffsDebuffs(slot, playerBoard, opponentBoard, true));
  allOpponentCards.forEach(slot => applyBuffsDebuffs(slot, opponentBoard, playerBoard, false));
  
  // Ensure no negative points
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
  const calcForPlayer = (board: (PlacedCard | null)[], mainColors: string[]) => {
    let totalPoints = 0;
    const colorCounts: Record<string, number> = {};
    
    mainColors.forEach(c => colorCounts[c] = 0);
    
    board.forEach(slot => {
      if (!slot || slot.cancelled) return;
      totalPoints += slot.modifiedPoints;
      
      slot.card.colors.forEach(color => {
        if (mainColors.includes(color)) {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
      });
    });
    
    return { totalPoints, colorCounts };
  };
  
  const playerScores = calcForPlayer(state.player.board, state.mainColors);
  const opponentScores = calcForPlayer(state.opponent.board, state.mainColors);
  
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