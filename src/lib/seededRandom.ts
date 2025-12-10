// Seeded random number generator for deterministic PvP effects
// Uses a simple hash of the seed string to produce consistent random values

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Create a seeded random generator from a string seed
export function createSeededRandom(seed: string): () => number {
  const hash = hashString(seed);
  return mulberry32(hash);
}

// Generate a deterministic random for PvP gambling effects
// Uses matchId + cardPosition + round to ensure both players get same result
export function getSeededGamblingRandom(
  matchId: string,
  cardPosition: number,
  round: number,
  effectIndex: number = 0
): number {
  const seed = `${matchId}-${cardPosition}-${round}-${effectIndex}`;
  const rng = createSeededRandom(seed);
  return rng();
}

// Deterministic coin flip
export function seededCoinFlip(
  matchId: string,
  cardPosition: number,
  round: number
): boolean {
  return getSeededGamblingRandom(matchId, cardPosition, round) < 0.5;
}

// Deterministic dice roll (1-6)
export function seededDiceRoll(
  matchId: string,
  cardPosition: number,
  round: number,
  dieIndex: number = 0
): number {
  const random = getSeededGamblingRandom(matchId, cardPosition, round, dieIndex);
  return Math.floor(random * 6) + 1;
}
