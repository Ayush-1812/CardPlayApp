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
  // Whether this app can draw the table. The server may well run the
  // game -- Monopoly Deal does -- but a tile must not promise a table
  // that is not here yet.
  table?: "app" | "website" | "soon";
  seats: number;
  // What the server will accept as a capacity for this game.
  min: number;
  max: number;
  // Whether playing with more than one deck means anything here. Bluff
  // deals them all out, so more decks is a real choice; a game with a
  // fixed deal ignores it.
  decks: boolean;
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
    table: "app",
    seats: 4,
    min: 4,
    max: 4,
    decks: false,
    playable: true,
  },
  {
    id: "bluff",
    name: "Bluff",
    suit: "♦",
    players: "3 to 6 players",
    blurb: "Play to the called rank — or pretend to. Get caught and take the pile.",
    goal: "Be the first with no cards left, and get away with your last play.",
    table: "app",
    seats: 4,
    min: 3,
    max: 6,
    decks: true,
    playable: true,
  },
  {
    id: "monopoly-deal",
    name: "Monopoly Deal",
    suit: "♠",
    players: "2 to 5 players",
    blurb: "Collect three full property sets. Steal, charge rent, say no.",
    goal: "Put down three complete property sets, each a different colour.",
    table: "website",
    seats: 4,
    min: 2,
    max: 5,
    decks: false,
    playable: true,
  },
  {
    id: "cambio",
    name: "Cambio",
    suit: "♣",
    players: "2 to 6 players",
    blurb: "Memory and nerve: swap your way to the lowest hand.",
    goal: "Finish with the lowest total in front of you.",
    table: "soon",
    seats: 4,
    min: 2,
    max: 6,
    decks: false,
    playable: false,
  },
];

export function gameByID(id: string | undefined): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
