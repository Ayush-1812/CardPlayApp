// How to play, in plain words, for someone holding a phone.
//
// The website has the same guides as pages you read. On a phone nobody
// reads a page before a game starts, so these are built as a handful of
// cards you swipe through, each one short enough to take in standing up,
// and then a question or two you answer by tapping real cards. Answering
// is how the legal moves get explained: the wrong card tells you why it
// is wrong rather than doing nothing.
//
// The words match what the server actually does. If a rule changes here,
// it changed there first.

// A small illustration under a lesson. Cards are codes like "AS", or
// "??" for face down.
export type Demo = {
  table?: string[];
  hand?: string[];
  caption?: string;
};

export type Lesson = {
  title: string;
  body: string;
  demo?: Demo;
};

export type Choice = {
  // A card code for a card question, or plain words for a choice.
  label: string;
  ok: boolean;
  // Why this is right, or why it is not. Shown the moment it is tapped.
  note: string;
};

export type Question =
  | { kind: "cards"; ask: string; lead?: string; hand: Choice[] }
  | { kind: "choices"; ask: string; options: Choice[] };

export type ScreenItem = { label: string; what: string };

export type Guide = {
  id: string;
  name: string;
  players: string;
  length: string;
  goal: string;
  lessons: Lesson[];
  questions: Question[];
  screen: ScreenItem[];
  tips: string[];
};

const trump: Guide = {
  id: "trump",
  name: "Trump",
  players: "exactly 4 players, in two teams",
  length: "about 10 minutes a round",
  goal: "Win 7 of the 13 tricks with your partner.",
  lessons: [
    {
      title: "You and the player opposite are a team",
      body: "Seats 1 and 3 play together, and so do seats 2 and 4. The players either side of you are both opponents, and every trick your partner wins counts for you.",
      demo: { caption: "Your partner sits across the table. Left and right are against you." },
    },
    {
      title: "One team names the trump suit",
      body: "Everyone gets 5 cards first. A toss decides which team chooses, and either player on that team can name a suit. You may pass the choice to your partner once — they must then choose, without having seen your cards.",
      demo: {
        hand: ["AH", "KH", "9H", "4S", "7C"],
        caption: "Five hearts to start, so hearts is worth calling.",
      },
    },
    {
      title: "Trumps beat everything",
      body: "After the suit is named, everyone gets 8 more cards and holds 13. A card of the trump suit beats any card of any other suit, however low it is.",
      demo: {
        table: ["AS", "2H"],
        caption: "Hearts are trumps: the two of hearts beats the ace of spades.",
      },
    },
    {
      title: "Follow the suit that was led",
      body: "Each trick, everyone plays one card going clockwise. If you hold the suit that was led, you must play it. Only when you have none of it may you play anything else — and you are never forced to trump.",
      demo: {
        table: ["7S"],
        hand: ["KS", "AD"],
        caption: "Spades were led and you hold one, so the king must go.",
      },
    },
    {
      title: "Seven tricks wins the round",
      body: "The highest trump takes the trick, or the highest card of the led suit if nobody trumped. The winner leads the next one. The first team to 7 tricks wins straight away — the rest of the cards are not played — and that team chooses trumps next round.",
    },
  ],
  questions: [
    {
      kind: "cards",
      ask: "Hearts are trumps. Spades were led. Which cards may you play?",
      lead: "9S",
      hand: [
        { label: "4S", ok: true, note: "Right. You hold a spade, so a spade is what you must play." },
        { label: "KS", ok: true, note: "Right — and the king wins this trick." },
        { label: "2H", ok: false, note: "Not yet. A trump is only allowed when you have none of the led suit, and you still hold spades." },
        { label: "AD", ok: false, note: "No. Spades were led and you have spades, so the diamond has to wait." },
      ],
    },
    {
      kind: "cards",
      ask: "Hearts are trumps. Clubs were led and you have no clubs. Which card wins the trick?",
      lead: "KC",
      hand: [
        { label: "3H", ok: true, note: "Yes. Any trump beats any club, so the three of hearts takes it." },
        { label: "AS", ok: false, note: "No. An ace of another suit cannot win — only trumps, or the suit that was led." },
        { label: "QD", ok: false, note: "No. It is legal to play, but a diamond cannot win a club trick." },
      ],
    },
  ],
  screen: [
    { label: "The call at the top", what: "The trump suit for this round, next to the voice button." },
    { label: "The middle", what: "The cards played so far this trick, and who led." },
    { label: "Your hand", what: "Sorted for you: trumps first, then the matching colour. Cards you cannot play are dimmed and say why." },
    { label: "Team counters", what: "Tricks won this round. Tap your own to look back through them." },
  ],
  tips: [
    "Count the trumps as they go. Once they are gone, your long suit starts winning.",
    "Leading a suit your partner is out of lets them trump it for the team.",
    "You need 7 tricks, not all 13 — and your partner's count is yours.",
    "Think before passing the call to your partner: they have not seen your cards.",
  ],
};

const bluff: Guide = {
  id: "bluff",
  name: "Bluff",
  players: "3 to 6 players",
  length: "about 10 minutes",
  goal: "Be the first player with no cards left — and get away with your last play.",
  lessons: [
    {
      title: "The table calls a rank",
      body: "Aces first, then Twos, then Threes, all the way to Kings and back to Aces. The call moves on after every play, whether or not anybody challenged it.",
      demo: { caption: "Call: Aces. Whatever you put down is announced as aces." },
    },
    {
      title: "You put down 1 to 4 cards, face down",
      body: "Any cards. They do not have to match the call — that is the whole game. The table is only told how many you played and what rank they are supposed to be. You cannot pass.",
      demo: {
        hand: ["AS", "7D", "7C"],
        caption: "Call is Aces. One real ace, or all three and hope nobody asks.",
      },
    },
    {
      title: "Anyone can call your bluff",
      body: "After every play everyone else gets five seconds to accept or to call bluff. Only the cards just played are turned over — never the rest of the pile. Saying nothing counts as accepting, and accepting is final.",
      demo: {
        table: ["??", "??", "??"],
        caption: "Three cards face down. Five seconds to decide.",
      },
    },
    {
      title: "Whoever is wrong picks up the pile",
      body: "If every card matches the call, the player was honest and the challenger takes the whole pile. If even one card is wrong, the player who put them down takes it. Play carries on with the next player either way.",
    },
    {
      title: "Your last card does not win on the spot",
      body: "Play it and the five seconds still run. If nobody challenges, you win. If someone challenges and you were honest, you win and they pick up. If you were lying, you pick up the pile and the game goes on. A bluff nobody calls wins the game — that is allowed.",
    },
  ],
  questions: [
    {
      kind: "cards",
      ask: "The call is Aces. Which of these can you put down?",
      hand: [
        { label: "AS", ok: true, note: "An honest ace. Safe if anyone asks." },
        { label: "7D", ok: true, note: "Also allowed. Any card can be played as any call — it is just a lie, and lying is the game." },
        { label: "KC", ok: true, note: "Allowed too. Nobody sees it unless somebody challenges." },
      ],
    },
    {
      kind: "choices",
      ask: "Someone played two cards as Kings. You are holding three kings yourself. What now?",
      options: [
        { label: "Call bluff", ok: true, note: "Good instinct. There are four kings in a deck and you hold three, so at most one of their two can be real." },
        { label: "Accept", ok: false, note: "You can, but you were holding the evidence: with three kings in your hand, both of theirs cannot be kings." },
        { label: "Wait and see", ok: false, note: "Waiting is accepting. The five seconds run out and the play stands." },
      ],
    },
    {
      kind: "choices",
      ask: "You challenged, the cards were turned over, and they all matched the call. Who picks up the pile?",
      options: [
        { label: "You do", ok: true, note: "Right. The player was honest, so the challenger takes the pile — a challenge is a risk, not a free look." },
        { label: "They do", ok: false, note: "No. They told the truth; it is the wrong challenge that costs." },
        { label: "Nobody", ok: false, note: "No. Somebody always picks up the pile after a challenge." },
      ],
    },
  ],
  screen: [
    { label: "Call", what: "The rank your play has to be announced as." },
    { label: "The pile", what: "Face-down cards in the middle, with how many there are." },
    { label: "The countdown", what: "How long is left to accept or call the last play." },
    { label: "Accept / Call bluff", what: "Your answer to the play just made. You only get one." },
    { label: "The other players", what: "How many cards each of them is holding." },
  ],
  tips: [
    "Nobody can see your cards, so a calm face costs nothing. Talking is part of the game.",
    "The pile grows fast. A challenge late in a round can hand someone twenty cards.",
    "Watch the card counts: a player down to one or two is about to win.",
    "Holding three of the called rank means somebody else is probably about to lie about it.",
  ],
};

const monopolyDeal: Guide = {
  id: "monopoly-deal",
  name: "Monopoly Deal",
  players: "2 to 5 players",
  length: "about 15 minutes",
  goal: "Be the first to put down three complete property sets, each one a different colour.",
  lessons: [
    {
      title: "Draw two, play up to three",
      body: "You start with 5 cards. Each turn you draw 2 and may play up to 3 of them — fewer or none is fine. If your hand was empty when your turn began, you draw 5 instead.",
    },
    {
      title: "Every card can be three things",
      body: "Money into your bank, property onto your table, or an action played once and discarded. Whichever you choose, it costs one of your three plays.",
    },
    {
      title: "Actions take money and property",
      body: "Rent charges for a colour you own. Debt Collector takes 5M from one player, It's My Birthday 2M from everyone. Sly Deal steals a property, Forced Deal swaps one, Deal Breaker takes a whole finished set. Just Say No cancels any of it — and can be cancelled by another Just Say No.",
    },
    {
      title: "You pay from the table, never from your hand",
      body: "Money in your bank and property in front of you is what settles a debt, and you choose which cards to hand over. There is no change: a 5M for a 2M debt means the 5M goes. If everything you own is worth less than the debt, you hand it all over and the rest is forgiven.",
    },
    {
      title: "Three sets, three colours",
      body: "Different colours need different numbers of cards — two for brown, three for red, four for the railroads — and the table tells you which. Keep three complete sets until your turn comes round and you win.",
    },
  ],
  questions: [
    {
      kind: "choices",
      ask: "Someone charges you 4M rent. Your bank is empty but you have properties out. What happens?",
      options: [
        { label: "You pay with property", ok: true, note: "Right. Property on your table is payment when the bank cannot cover it — and you pick which goes." },
        { label: "You pay from your hand", ok: false, note: "No. Cards in your hand are never payment, however much money is sitting there." },
        { label: "You owe nothing", ok: false, note: "No. An empty bank does not cancel a debt while you still own property." },
      ],
    },
    {
      kind: "choices",
      ask: "You play a property, bank a 2M and play a rent card. Can you also play a Sly Deal?",
      options: [
        { label: "No, that was three plays", ok: true, note: "Right. Money, property and actions all count the same, and three is the limit." },
        { label: "Yes, actions do not count", ok: false, note: "They do. Anything you put down costs one of your three plays." },
        { label: "Only if you have money left", ok: false, note: "Money has nothing to do with it — the limit is on plays, not cost." },
      ],
    },
  ],
  screen: [
    { label: "Your hand", what: "The row at the bottom. Tap a card to choose how to play it." },
    { label: "Your table", what: "Your bank on the left, your property sets beside it." },
    { label: "The other tables", what: "Above yours. Tap a name to look at a different opponent." },
    { label: "Plays left", what: "How many cards you may still put down this turn." },
  ],
  tips: [
    "Hold on to a Just Say No. It is the only thing that stops a Deal Breaker.",
    "Money in the bank is what saves your properties when rent lands.",
    "A wild card counts as the colour you place it on, and you can move it on your own turn for free.",
    "Look at what colours others are close to finishing before you hand them rent.",
  ],
};

const cambio: Guide = {
  id: "cambio",
  name: "Cambio",
  players: "2 to 6 players",
  length: "about 10 minutes",
  goal: "Finish with the lowest total in front of you.",
  lessons: [
    {
      title: "Four cards, face down",
      body: "You are dealt four cards you may not look at, except for two of them once, at the start. Remembering what is where is most of the game.",
      demo: { hand: ["??", "??", "??", "??"], caption: "You get one look at two of these." },
    },
    {
      title: "Draw, then keep or use",
      body: "Each turn you take the top card. Swap it for one of your face-down cards, or use what it does and discard it — some ranks let you peek at a card, swap two cards, or look at somebody else's.",
    },
    {
      title: "Call Cambio to end it",
      body: "When you think you are lowest, call Cambio. Everyone else gets one more turn, then all the cards are turned over and counted.",
    },
    {
      title: "Lowest total wins",
      body: "Number cards count their face value, so aces are good and kings are not. Call too early and somebody beats you; call too late and someone else calls first.",
    },
  ],
  questions: [
    {
      kind: "choices",
      ask: "You draw a king and your face-down cards are all low as far as you remember. What is the better move?",
      options: [
        { label: "Discard the king", ok: true, note: "Right. A king is the worst thing to be holding at the end, so get rid of it rather than swap it in." },
        { label: "Swap it in", ok: false, note: "That puts your highest card into your own total — the opposite of what you want." },
      ],
    },
  ],
  screen: [
    { label: "Your four cards", what: "Face down in front of you. Tap one when a card lets you act on it." },
    { label: "The draw and the discard", what: "In the middle. What you take and what you throw away." },
    { label: "Cambio", what: "Ends the round after everyone has had one more turn." },
  ],
  tips: [
    "Say the two cards you were shown to yourself in order. You will need them six turns later.",
    "Watch what other players swap, not just what they draw.",
    "An ace is worth one. Swapping a king for an ace is worth a whole turn.",
  ],
};

export const GUIDES: Guide[] = [trump, bluff, monopolyDeal, cambio];

export function guideFor(id: string | undefined): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
