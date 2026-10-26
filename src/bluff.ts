// Bluff, as the server describes it.
//
// The server decides everything, including whether a challenge arrived in
// time. Nothing here is a rule: these are the shapes it sends, and the
// words the table says about them.

import type { CardCode } from "./components/card";

export type BluffPhase = "play" | "challenge" | "over";

export type BluffRank =
  | "a"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "j"
  | "q"
  | "k";

export type BluffSuit = "spades" | "hearts" | "diamonds" | "clubs";

// A claim is a declaration: how many cards, called as what. The cards
// themselves are not in it, because nobody may see them yet.
export type BluffClaim = {
  id: string;
  seat: number;
  rank: BluffRank;
  count: number;
  rank_name: string;
};

// A reveal is a resolved challenge: the one place card identities reach
// everybody.
export type BluffReveal = {
  play_id: string;
  claimed: BluffRank;
  cards: string[];
  player: number;
  challenger: number;
  truthful: boolean;
  collector: number;
  collected: number;
};

export type BluffPublic = {
  phase: BluffPhase;
  turn: number;
  rank: BluffRank;
  rank_name: string;
  counts: number[];
  pile_count: number;
  last?: BluffClaim;
  accepted: boolean[];
  deadline?: string;
  pending: number;
  winner: number;
  result?: BluffReveal;
  max_cards: number;
};

export type BluffSelf = {
  seat: number;
  hand: string[];
  may_play: boolean;
  may_answer: boolean;
  answer_id?: string;
};

export type BluffView = { public: BluffPublic; self: BluffSelf };

export const SUIT_SYMBOL: Record<BluffSuit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export const SUIT_NAME: Record<BluffSuit, string> = {
  spades: "spades",
  hearts: "hearts",
  diamonds: "diamonds",
  clubs: "clubs",
};

const SUIT_LETTER: Record<BluffSuit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

const RANK_LABEL: Record<BluffRank, string> = {
  a: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  j: "J",
  q: "Q",
  k: "K",
};

const RANK_WORD: Record<BluffRank, string> = {
  a: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  j: "Jack",
  q: "Queen",
  k: "King",
};

// The cycle the call follows, so the table can say what comes next.
export const RANK_ORDER: BluffRank[] = [
  "a",
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
];

// A card id is "rank-suit", with a copy marker when more than one deck is
// in play: "q-hearts#2" is the second deck's queen of hearts -- a
// different card that reads the same.
export function parseCard(
  id: string,
): { rank: BluffRank; suit: BluffSuit } | null {
  const bare = id.split("#")[0];
  const cut = bare.lastIndexOf("-");
  if (cut <= 0) return null;
  const rank = bare.slice(0, cut) as BluffRank;
  const suit = bare.slice(cut + 1) as BluffSuit;
  if (!RANK_LABEL[rank] || !SUIT_SYMBOL[suit]) return null;
  return { rank, suit };
}

export function cardCode(id: string): CardCode | undefined {
  const card = parseCard(id);
  if (!card) return undefined;
  return `${RANK_LABEL[card.rank]}${SUIT_LETTER[card.suit]}` as CardCode;
}

// Which deck a card came from, when there is more than one. Two identical
// cards in a hand are confusing without it.
export function deckOf(id: string): number {
  const marker = id.split("#")[1];
  const n = marker ? Number(marker) : 1;
  return Number.isFinite(n) ? n : 1;
}

export function rankLabel(rank: BluffRank): string {
  return RANK_LABEL[rank] ?? String(rank).toUpperCase();
}

export function rankWord(rank: BluffRank, plural = false): string {
  const word = RANK_WORD[rank] ?? rank;
  if (!plural) return word;
  return rank === "6" ? "Sixes" : `${word}s`;
}

// Cards grouped by rank in playing order, so whatever matches the call
// sits together. A convenience only: every card stays playable, and
// nothing here hints at what to do.
export function sortHand(hand: string[]): string[] {
  return [...hand].sort((a, b) => {
    const left = parseCard(a);
    const right = parseCard(b);
    if (!left || !right) return a.localeCompare(b);
    const byRank =
      RANK_ORDER.indexOf(left.rank) - RANK_ORDER.indexOf(right.rank);
    return byRank !== 0 ? byRank : left.suit.localeCompare(right.suit);
  });
}

// How long the challenge window has left. For the countdown only --
// whether a challenge was in time is the server's call, never this.
export function secondsLeft(deadline: string | undefined): number {
  if (!deadline) return 0;
  const left = Date.parse(deadline) - Date.now();
  return left <= 0 ? 0 : Math.ceil(left / 1000);
}

// What the table is being told, in one line.
export function declaration(name: string, claim: BluffClaim): string {
  return `${name} played ${claim.count} ${claim.rank_name}`;
}

// What happened when a challenge was resolved, said plainly and from the
// reader's point of view.
export function revealSentence(
  reveal: BluffReveal,
  nameOf: (seat: number) => string,
  mySeat: number,
): string {
  const player =
    reveal.player === mySeat ? "You were" : `${nameOf(reveal.player)} was`;
  const challenger =
    reveal.challenger === mySeat ? "You" : nameOf(reveal.challenger);
  const collector =
    reveal.collector === mySeat
      ? "You pick up"
      : `${nameOf(reveal.collector)} picks up`;
  const cards = `${reveal.collected} card${reveal.collected === 1 ? "" : "s"}`;
  return `${player} ${reveal.truthful ? "honest" : "bluffing"}. ${challenger} called it. ${collector} ${cards}.`;
}
