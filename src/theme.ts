// One place for how the app looks. The felt and the gold come from the
// CardPlay website, so the two feel like one product, but the sizes are
// chosen for a phone held in one hand rather than a desktop pointer.

export const colour = {
  felt: "#15503a",
  feltDark: "#0d2a1e",
  feltDeep: "#071a12",
  panel: "rgba(0, 0, 0, 0.3)",
  panelSolid: "#12241c",
  line: "rgba(239, 192, 73, 0.22)",
  cream: "#f3ead6",
  creamSoft: "#c9c1a8",
  accent: "#efc049",
  accentInk: "#1b1b1b",
  danger: "#c2553f",
  dangerInk: "#ffd9d9",
  good: "#4f9d69",
  cardFace: "#fbf7ec",
  cardInk: "#15181d",
  cardRed: "#a81f2b",
  cardBack: "#2b4c7e",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// Type sizes. Nothing below 13 for body text: a card table is read at
// arm's length, often in a hurry.
export const type = {
  title: { fontSize: 28, fontWeight: "800" },
  heading: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
  small: { fontSize: 12, fontWeight: "400" },
  mono: { fontSize: 13, fontVariant: ["tabular-nums"] },
} as const;

// The smallest a thing may be and still be comfortable to tap. Android's
// guidance is 48dp; nothing interactive in this app goes below it.
export const TOUCH = 48;

// How long things take to move. Short enough to feel instant, long enough
// to be followed by the eye.
export const motion = {
  quick: 140,
  normal: 220,
  slow: 380,
} as const;
