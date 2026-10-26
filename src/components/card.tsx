// A playing card, drawn big enough to read.
//
// On a phone the hand is the thing you look at most and have the least
// room for, so a card here is sized by how many have to fit rather than
// by a fixed number of pixels, and the rank sits in the corner at a size
// that survives being glanced at while someone is talking to you.

import { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { colour, radius, space, type as text } from "../theme";

export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type CardCode = `${Rank}${Suit}`;

export const SUIT_MARK: Record<Suit, string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export const SUIT_NAME: Record<Suit, string> = {
  S: "spades",
  H: "hearts",
  D: "diamonds",
  C: "clubs",
};

const RANK_NAME: Record<Rank, string> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

export function parse(code: string): { rank: Rank; suit: Suit } | null {
  const match = /^(10|[A2-9JQK])([SHDC])$/.exec(code.toUpperCase());
  if (!match) return null;
  return { rank: match[1] as Rank, suit: match[2] as Suit };
}

// What a screen reader says instead of "A♠".
export function spoken(code: string): string {
  const card = parse(code);
  return card ? `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}` : code;
}

// Cards keep the proportions of the real thing, so a width is all a
// caller has to decide.
export const CARD_RATIO = 1.45;

type Props = {
  code?: string;
  // Face down: the pile, and other players' hands.
  down?: boolean;
  width: number;
  selected?: boolean;
  // Dimmed with a reason attached, which is how this app explains an
  // illegal move instead of silently ignoring a tap.
  disabled?: boolean;
  reason?: string;
  onPress?: () => void;
  style?: ViewStyle;
  // Lifts the card, for the one that just won a trick.
  highlight?: boolean;
};

export const Card = memo(function Card({
  code,
  down = false,
  width,
  selected = false,
  disabled = false,
  reason,
  onPress,
  style,
  highlight = false,
}: Props) {
  const height = Math.round(width * CARD_RATIO);
  const card = code ? parse(code) : null;
  const red = card?.suit === "H" || card?.suit === "D";
  const face = {
    width,
    height,
    borderRadius: Math.max(6, Math.round(width * 0.09)),
  };

  const body = down ? (
    <View style={[styles.card, styles.back, face, style]}>
      <View style={styles.backInner} />
    </View>
  ) : (
    <View
      style={[
        styles.card,
        face,
        selected && styles.selected,
        highlight && styles.highlight,
        disabled && styles.dim,
        style,
      ]}
    >
      <Text
        style={[
          styles.rank,
          { fontSize: Math.max(13, Math.round(width * 0.34)) },
          red && styles.red,
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {card?.rank ?? "?"}
      </Text>
      <Text
        style={[
          styles.suit,
          { fontSize: Math.max(12, Math.round(width * 0.3)) },
          red && styles.red,
        ]}
        allowFontScaling={false}
      >
        {card ? SUIT_MARK[card.suit] : ""}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={down ? "Face-down card" : spoken(code ?? "")}
      accessibilityHint={disabled ? reason : "Play this card"}
      accessibilityState={{ disabled, selected }}
      // A card is narrow, so the touch target reaches past its edges.
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      {body}
    </Pressable>
  );
});

// A row of cards that overlap when there are too many to lay out flat,
// which on a phone is nearly always.
export function fanWidth(
  count: number,
  available: number,
  max = 76,
): { width: number; overlap: number } {
  const width = Math.min(max, Math.max(42, Math.floor(available / 3.2)));
  if (count <= 1) return { width, overlap: 0 };
  const needed = count * width;
  if (needed <= available) return { width, overlap: 0 };
  // Leave a sliver of every card showing: enough to read its corner.
  const slice = Math.max(width * 0.34, (available - width) / (count - 1));
  return { width, overlap: Math.round(width - slice) };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colour.cardFace,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.25)",
    paddingVertical: space.xs,
  },
  back: {
    backgroundColor: colour.cardBack,
    padding: 4,
    borderColor: "rgba(255,255,255,0.25)",
  },
  backInner: {
    flex: 1,
    alignSelf: "stretch",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  rank: { ...text.label, color: colour.cardInk, fontWeight: "800" },
  suit: { color: colour.cardInk, marginTop: -2 },
  red: { color: colour.cardRed },
  selected: {
    borderColor: colour.accent,
    borderWidth: 2,
    transform: [{ translateY: -10 }],
  },
  highlight: { borderColor: colour.accent, borderWidth: 2 },
  dim: { opacity: 0.4 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
