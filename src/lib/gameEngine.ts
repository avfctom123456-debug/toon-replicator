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
  // AI picks random 12 cards
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
  
  // Simple AI: pick cards with highest points, prefer main colors
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
    };
    usedCharacters.add(card.character);
    placed++;
  }
  
  // Remove placed cards from hand
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
  
  // Check for same characters and cancel them
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
  
  // Cancel duplicates within same player
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
  
  // Cancel matching characters between players
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

export function applyPowers(state: GameState): GameState {
  const newState = { ...state };
  const playerBoard = [...state.player.board];
  const opponentBoard = [...state.opponent.board];
  
  const allActiveCards = [
    ...playerBoard.filter((s): s is PlacedCard => s !== null && !s.cancelled).map(s => s.card),
    ...opponentBoard.filter((s): s is PlacedCard => s !== null && !s.cancelled).map(s => s.card),
  ];
  
  const applyPowerToBoard = (board: (PlacedCard | null)[]) => {
    return board.map(slot => {
      if (!slot || slot.cancelled) return slot;
      
      let modifiedPoints = slot.card.basePoints;
      const desc = slot.card.description.toLowerCase();
      
      // Parse powers like "+5 if any TOM is in play"
      const ifMatch = desc.match(/\+(\d+)\s+if\s+(?:any\s+)?(.+?)\s+is\s+in\s+play/);
      if (ifMatch) {
        const bonus = parseInt(ifMatch[1]);
        const target = ifMatch[2].toLowerCase();
        if (allActiveCards.some(c => c.character.toLowerCase().includes(target))) {
          modifiedPoints += bonus;
        }
      }
      
      // Parse "x2 if next to X"
      const x2Match = desc.match(/x2\s+if\s+(?:next\s+to\s+)?(.+)/);
      if (x2Match) {
        const target = x2Match[1].toLowerCase().replace("is in play", "").trim();
        if (allActiveCards.some(c => c.character.toLowerCase().includes(target))) {
          modifiedPoints *= 2;
        }
      }
      
      return { ...slot, modifiedPoints };
    });
  };
  
  newState.player = { ...state.player, board: applyPowerToBoard(playerBoard) };
  newState.opponent = { ...state.opponent, board: applyPowerToBoard(opponentBoard) };
  
  return newState;
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
  
  // Check color win condition
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
  
  // Points win condition
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