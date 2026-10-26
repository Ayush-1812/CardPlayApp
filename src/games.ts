// The games this app can sit you down at, and how to describe them to
// somebody who has never played. The server is the authority on what is
// playable; this is how they are introduced.

export type GameInfo = {
  id: string;
  name: string;
  suit: string;
  players: string;
  // One line on the tile.
  blurb: string;
  // The first thing the tutorial says.
  goal: string;
  seats: number;
  playable: boolean;
};

export const GAMES: GameInfo[] = [
  {
    id: "trump",
    name: "Trump",
    suit: "♥",
    players: "4 players, two teams",
    blurb: "Pick a trump suit with your partner. First team to seven tricks.",
    goal: "Win 7 of the 13 tricks with the player sitting opposite you.",
    seats: 4,
    playable: true,
  },
  {
    id: "bluff",
    name: "Bluff",
    suit: "♦",
    players: "3 to 6 players",
    blurb: "Play to the called rank — or pretend to. Get caught and take the pile.",
    goal: "Be the first with no cards left, and get away with your last play.",
    seats: 4,
    playable: true,
  },
  {
    id: "monopoly-deal",
    name: "Monopoly Deal",
    suit: "♠",
    players: "2 to 5 players",
    blurb: "Collect three full property sets. Steal, charge rent, say no.",
    goal: "Put down three complete property sets, each a different colour.",
    seats: 4,
    playable: true,
  },
  {
    id: "cambio",
    name: "Cambio",
    suit: "♣",
    players: "2 to 6 players",
    blurb: "Memory and nerve: swap your way to the lowest hand.",
    goal: "Finish with the lowest total in front of you.",
    seats: 4,
    playable: false,
  },
];

export function gameByID(id: string | undefined): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
