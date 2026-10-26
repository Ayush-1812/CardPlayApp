// Trump, as the server describes it.
//
// The server is the authority on every rule. Nothing here decides an
// outcome: these are the shapes it sends, the order a hand reads best in,
// and -- the one that matters on a phone -- an honest sentence about why a
// card cannot be played, so a tap is never silently ignored.

import type { CardCode } from "./components/card";

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

// The suit is always written out next to its symbol. Colour on its own
// must never carry meaning, and red against black is invisible to a lot
// of players.
export const SUIT_NAME: Record<Suit, string> = {
  spades: "Spades",
  hearts: "Hearts",
  diamonds: "Diamonds",
  clubs: "Clubs",
};

const SUIT_LETTER: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

const RANK_LABEL: Record<string, string> = {
  a: "A",
  k: "K",
  q: "Q",
  j: "J",
  "10": "10",
  "9": "9",
  "8": "8",
  "7": "7",
  "6": "6",
  "5": "5",
  "4": "4",
  "3": "3",
  "2": "2",
};

// Lowest to highest, so a higher index is a stronger card.
const RANK_ORDER = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "j",
  "q",
  "k",
  "a",
];

export type TrumpCard = { id: string; suit: Suit; rank: string };

// Card ids come from the server as "hearts-q".
export function parseCard(id: string): TrumpCard | null {
  const cut = id.lastIndexOf("-");
  if (cut < 0) return null;
  const suit = id.slice(0, cut) as Suit;
  const rank = id.slice(cut + 1);
  if (!SUITS.includes(suit) || !RANK_LABEL[rank]) return null;
  return { id, suit, rank };
}

// The code the card component draws, for example "QH".
export function cardCode(id: string): CardCode | undefined {
  const card = parseCard(id);
  if (!card) return undefined;
  return `${RANK_LABEL[card.rank]}${SUIT_LETTER[card.suit]}` as CardCode;
}

export type Play = { seat: number; card: string };

export type TrumpTrick = {
  cards: Play[];
  lead: Suit;
  winner: number;
  team: number;
};

export type RoundResult = {
  round: number;
  trump: Suit;
  chooser: number;
  delegated: boolean;
  winner: number;
  tricks: [number, number];
};

export type TrumpSeat = {
  seat: number;
  team: number;
  cards: number;
  ready: boolean;
  user_id: string;
};

export type TrumpStage =
  | "waiting_for_players"
  | "trump_decision"
  | "delegated_trump_decision"
  | "active_trick"
  | "completed_trick"
  | "completed_round"
  | "waiting_for_readiness";

export type TrumpPublic = {
  phase: "trump_selection" | "play" | "round_over";
  stage: TrumpStage;
  round: number;
  trump?: Suit;
  lead_suit?: Suit;
  entitled_team: number;
  decider: number;
  chooser: number;
  delegated: boolean;
  leader: number;
  turn: number;
  trick: Play[];
  last_trick?: TrumpTrick;
  tricks: [number, number];
  rounds_won: [number, number];
  tricks_to_win: number;
  players: TrumpSeat[];
  history: RoundResult[];
};

export type TrumpSelf = {
  seat: number;
  team: number;
  hand: string[];
  legal: string[];
  won: TrumpTrick[];
  may_choose: boolean;
  may_delegate: boolean;
};

export type TrumpView = { public: TrumpPublic; self: TrumpSelf };

export const TEAM_NAME = ["Team A", "Team B"];

// Where each seat sits on screen. The viewer is always at the bottom and
// their partner opposite, whichever seat they were actually dealt -- the
// real turn order is untouched.
export function seatRing(mySeat: number): {
  bottom: number;
  left: number;
  top: number;
  right: number;
} {
  return {
    bottom: mySeat,
    left: (mySeat + 1) % 4,
    top: (mySeat + 2) % 4,
    right: (mySeat + 3) % 4,
  };
}

// Why a card cannot be played now, in the player's own terms. The server
// decides for real; this has to be honest about the common cases so the
// table always has something to say.
export function whyIllegal(
  id: string,
  pub: TrumpPublic,
  self: TrumpSelf,
  myTurn: boolean,
): string | null {
  if (self.legal.includes(id)) return null;
  if (pub.phase !== "play") return "The round is not in play yet.";
  if (!myTurn) return "It is not your turn.";
  const lead = pub.lead_suit;
  if (lead) {
    const card = parseCard(id);
    const holds = self.hand.some((c) => parseCard(c)?.suit === lead);
    if (holds && card?.suit !== lead)
      return `You must follow ${SUIT_NAME[lead].toLowerCase()} ${SUIT_SYMBOL[lead]} while you still hold one.`;
  }
  return "That card cannot be played right now.";
}

// Spades pair with clubs, hearts with diamonds. Used only to keep a hand
// readable.
export const SAME_COLOUR: Record<Suit, Suit> = {
  spades: "clubs",
  clubs: "spades",
  hearts: "diamonds",
  diamonds: "hearts",
};

// A hand in the order a player wants to read it: trumps first, then the
// suit of the same colour, then the rest, each suit from the top down.
export function sortHand(hand: string[], trump?: Suit): string[] {
  const order: Suit[] = trump
    ? [
        trump,
        SAME_COLOUR[trump],
        ...SUITS.filter((s) => s !== trump && s !== SAME_COLOUR[trump]),
      ]
    : [...SUITS];
  const key = (id: string): [number, number] => {
    const card = parseCard(id);
    if (!card) return [order.length, 0];
    const suit = order.indexOf(card.suit);
    return [suit < 0 ? order.length : suit, -RANK_ORDER.indexOf(card.rank)];
  };
  return [...hand].sort((a, b) => {
    const [sa, ra] = key(a);
    const [sb, rb] = key(b);
    return sa - sb || ra - rb;
  });
}

// One line saying what the table is waiting for. On a phone there is no
// room for a status panel, so this is the whole of it.
export function waitingFor(
  pub: TrumpPublic,
  self: TrumpSelf,
  nameOf: (seat: number) => string,
): string {
  const mine = pub.turn === self.seat;
  switch (pub.stage) {
    case "waiting_for_players":
      return "Waiting for the table to fill.";
    case "trump_decision":
      return self.may_choose
        ? "Choose the trump suit."
        : `${nameOf(pub.decider)} is choosing the trump suit.`;
    case "delegated_trump_decision":
      return self.may_choose
        ? "Your partner passed it to you. Choose the trump suit."
        : `${nameOf(pub.decider)} was passed the choice.`;
    case "active_trick":
      return mine ? "Your turn." : `${nameOf(pub.turn)} to play.`;
    case "completed_trick":
      return pub.last_trick
        ? `${nameOf(pub.last_trick.winner)} took the trick.`
        : "Trick over.";
    case "completed_round":
    case "waiting_for_readiness":
      return "Round over. Ready up for the next one.";
    default:
      return "";
  }
}
