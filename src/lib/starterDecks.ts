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
    name: "Justice League",
    description: "Heroes that buff each other with Justice League synergies",
    cardIds: [
      27,  // Batman (GREEN) - Justice League, -5 to opposite if not Hero
      28,  // Batman Running (BLUE) - Justice League, 10 pts
      14,  // Aquaman (PURPLE) - +3 to all Green cards
      11,  // Amazo (SILVER) - +2 for each Justice League member
      167, // Green Lantern (GREEN) - Justice League
      168, // Green Lantern Flying (GREEN) - 10 pts
      356, // Superman (BLUE) - Justice League, 10 pts
      357, // Superman Unchained (PURPLE) - +10 if any Brainiac
      47,  // Brainiac (YELLOW) - +4 if next to Lex Luthor, +4 if Superman in play
      26,  // Batgirl (BLACK) - 10 pts Hero
      29,  // Batmobile (BLACK) - 9 pts Vehicle
      13,  // Aqualad (BLACK) - 10 pts Hero
    ],
  },
  {
    slot: "B", 
    name: "Powerpuff Power",
    description: "Powerpuff Girls with villain debuffs and color synergies",
    cardIds: [
      41,  // Blossom Fighting (BLUE) - Powerpuff, 10 pts
      43,  // Blossom with Bunny (ORANGE) - +5 if any Bugs Bunny
      48,  // Bubbles Flying (YELLOW) - 8 pts
      49,  // Bubbles Laughing (ORANGE) - +6 to any other Powerpuff member
      50,  // Bubbles with Flowers (ORANGE) - +2 to Buttercup, Blossom, etc
      59,  // Buttercup Fighting (BLUE) - +1 for each Villain in play
      61,  // Buttercup with Snowball (BLUE) - 10 pts
      67,  // Chemical X (SILVER) - +1 for each Female
      53,  // Bugs Grinnin' (ORANGE) - 10 pts for Blossom synergy
      6,   // Aku (GREEN) - Villain 10 pts
      38,  // Bizarro (YELLOW) - Villain
      35,  // Billy (BLACK) - 9 pts
    ],
  },
  {
    slot: "C",
    name: "Looney Tunes",
    description: "Classic cartoon characters with neighbor synergies", 
    cardIds: [
      53,  // Bugs Grinnin' (ORANGE) - 10 pts
      55,  // Bugs Singin' (YELLOW) - +5 if next to any Daffy Duck
      94,  // Daffy Duck (BLUE) - 7 pts
      18,  // Baby Daffy (PURPLE) - -5 to opposing if not Animal
      20,  // Baby Sylvester (PURPLE) - +3 to all other Purple cards
      25,  // Barney Rubble (PURPLE) - +10 if next to Fred Flintstone
      70,  // Chicken (PURPLE) - 8 pts Animal
      88,  // Courage Screaming (PURPLE) - 7 pts
      120, // Earl (PURPLE) - 10 pts
      77,  // Clover (ORANGE) - 10 pts
      82,  // Coop (ORANGE) - 10 pts, x2 to Megas
      62,  // Captain Dodgers (ORANGE) - 10 pts
    ],
  },
  {
    slot: "D",
    name: "Teen Titans",
    description: "Teen Titans with group synergies and debuffs",
    cardIds: [
      30,  // Beast Boy (GREEN) - +3 if Robin in play
      32,  // Beast Boy Kitten (SILVER) - +8 if next to Thunder
      92,  // Cyborg (BLACK) - Teen Titans, 9 pts
      312, // Robin (GREEN) - Teen Titans, +10 if next to Starfire
      313, // Robin Kicking (YELLOW) - 10 pts
      40,  // Bloo (GREEN) - 10 pts Imaginary Friend
      9,   // Alex (GREEN) - 8 pts Hero
      90,  // Cow (GREEN) - 9 pts
      96,  // Daphne Celebrating (GREEN) - 10 pts
      103, // Dexter (BLUE) - 10 pts
      98,  // Dee Dee (PURPLE) - +5 if next to Dexter
      100, // Dee Dee Monster (YELLOW) - 10 pts
    ],
  },
];

// Get all starter deck card IDs for a specific slot
export function getStarterDeckBySlot(slot: string): number[] {
  const deck = starterDecks.find(d => d.slot === slot);
  return deck ? deck.cardIds : [];
}