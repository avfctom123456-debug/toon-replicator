// Starter decks with card synergies built-in
// Each deck has 12 cards with strategic combinations

export interface StarterDeck {
  slot: string;
  name: string;
  cardIds: number[];
  description: string;
}

export const starterDecks: StarterDeck[] = [
  {
    slot: "A",
    name: "Clone Wars",
    description: "Jedi and Clone synergies from the Clone Wars series",
    cardIds: [
      405, // General Kenobi (GREEN) - 8 pts Jedi
      406, // Kenobi Civilized (YELLOW) - +2 to each Clone
      415, // The High Ground (YELLOW) - +10 to Kenobi if adjacent
      407, // Captain Rex (YELLOW) - 7 pts Clone
      409, // Clone Trooper (ORANGE) - -1 to Sith, can stack
      409, // Clone Trooper (ORANGE) - duplicate allowed
      412, // Droideka (YELLOW) - 10 pts Droid
      410, // Battle Droid (PURPLE) - -1 to Jedi
      413, // Count Dooku (RED) - +2 to each Droid
      414, // Ventress (BLACK) - +10 to Dooku if adjacent
      404, // Darth Anakin (RED) - +3 per Clone or Droid
      408, // Senator Amidala (PINK) - -5 to Anakin/Vader
    ],
  },
  {
    slot: "B",
    name: "Kung Fu Masters",
    description: "Kung Fu Panda heroes with Po and Master synergies",
    cardIds: [
      480, // Po Eating (SILVER) - +2 to all Black Cards
      481, // Po the Dragon Warrior (PURPLE) - 10 pts Hero
      488, // Master Oogway (GREEN) - x2 to neighboring Po
      482, // Master Shifu (RED) - +3 to each Silver gtoon
      483, // Master Tigress (ORANGE) - 9 pts Hero
      484, // Master Viper (YELLOW) - 6 pts Hero
      485, // Master Monkey (BLUE) - 5 pts Hero
      486, // Master Mantis (GREEN) - 5 pts Hero
      487, // Master Crane (PURPLE) - +5 if played in 2nd round
      490, // Tai Lung (RED) - -5 to Po, -2 to round 1 Animals
      491, // The Chameleon (PINK) - Cancel opposite gtoon
      489, // Spirit Oogway (PINK) - -4 to all elementals
    ],
  },
  {
    slot: "C",
    name: "Despicable Minions",
    description: "Gru and Minion synergies with villain debuffs",
    cardIds: [
      467, // Gru (ORANGE) - -5 to 2nd round villains
      468, // Kid Gru (YELLOW) - 5 pts Villain
      472, // Stuart (GREEN) - +2 to Gru per minion
      473, // Bob (BLUE) - 8 pts Minion
      474, // Dave (PURPLE) - 10 pts Minion
      475, // Jerry (PINK) - 6 pts Minion
      479, // Evil Minion (SILVER) - +2 to Purple Cards
      471, // Agnes (SILVER) - +2 to each Pink Card
      470, // Edith (PINK) - 6 pts
      469, // Margo (PURPLE) - -1 per opponent Male
      476, // Vector (ORANGE) - -3 to other Orange
      477, // The Moon (BLUE) - -5 to Vector, +2 to Saiyans
    ],
  },
  {
    slot: "D",
    name: "Dragon Ball Z",
    description: "Saiyans, Namekians, and powerful energy attacks",
    cardIds: [
      454, // Spirit Goku (YELLOW) - 10 pts Saiyan Spirit
      458, // Kid Goku (GREEN) - 7 pts Saiyan Hero
      465, // Prince Vegeta (ORANGE) - -3 to Politicians
      457, // Angry Bulma (PINK) - x2 to Vegeta
      456, // Piccolo (ORANGE) - 9 pts Namekian Hero
      463, // Dende (SILVER) - Makes negative points positive
      466, // Training Gohan (RED) - +5 if Moon in play
      477, // The Moon (BLUE) - +2 to all Saiyans
      460, // Trunks from Future (SILVER) - -2 per Droid
      461, // Trunks the Child (PURPLE) - 8 pts Prince Saiyan
      464, // Senzu Bean (PINK) - +2 to all DBZ Toons
      459, // Chi Chi (YELLOW) - -10 to any Goku
    ],
  },
];

// Get all starter deck card IDs for a specific slot
export function getStarterDeckBySlot(slot: string): number[] {
  const deck = starterDecks.find(d => d.slot === slot);
  return deck ? deck.cardIds : [];
}
