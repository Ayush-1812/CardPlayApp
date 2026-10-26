// Trump on a phone.
//
// A screen this size cannot show a whole table, so it shows the three
// things a player needs between taps: what is trumps, what has been
// played into this trick, and which of their own cards they are allowed
// to play. Everything else -- scores, the last trick, who is connected --
// is one tap away rather than permanently in the way.

import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Button } from "../components/button";
import { Card, fanWidth } from "../components/card";
import type { MatchState } from "../live";
import { colour, motion, radius, space, TOUCH, type as text } from "../theme";
import {
  cardCode,
  seatRing,
  sortHand,
  SUIT_NAME,
  SUIT_SYMBOL,
  SUITS,
  TEAM_NAME,
  waitingFor,
  whyIllegal,
  type TrumpView,
} from "../trump";

type Send = (kind: string, payload?: unknown) => Promise<string | null>;

export function TrumpTable({
  match,
  send,
}: {
  match: MatchState;
  send: Send;
}) {
  const view = match.view as TrumpView | undefined;
  const { width } = useWindowDimensions();
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);

  // A notice is a reason, not an error: it fades on its own so the player
  // is not left dismissing things mid-game.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!view)
    return (
      <View style={styles.middle}>
        <Text style={styles.waiting}>Dealing…</Text>
      </View>
    );

  const pub = view.public;
  const self = view.self;
  const ring = seatRing(self.seat);
  const myTurn = pub.turn === self.seat && pub.stage === "active_trick";
  const hand = sortHand(self.hand, pub.trump);
  const fan = fanWidth(hand.length, width - space.lg * 2, 70);

  const nameOf = (seat: number) =>
    match.participants?.find((p) => p.seat === seat)?.display_name ??
    `Seat ${seat + 1}`;
  const seatOf = (seat: number) => pub.players.find((p) => p.seat === seat);
  const playedBy = (seat: number) =>
    pub.trick.find((play) => play.seat === seat)?.card;

  async function act(kind: string, payload?: unknown, label?: string) {
    setSending(label ?? kind);
    const problem = await send(kind, payload);
    setSending(null);
    if (problem) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotice(problem);
    }
  }

  function tapCard(id: string) {
    const why = whyIllegal(id, pub, self, myTurn);
    if (why) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotice(why);
      return;
    }
    void act("play_card", { card: id }, id);
  }

  return (
    <View style={styles.table}>
      {/* The call, the score, and whose move it is: one strip across the
          top, where it cannot cover a card. */}
      <View style={styles.top}>
        <Pressable
          onPress={() => setShowScores((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={
            pub.trump
              ? `Trumps are ${SUIT_NAME[pub.trump]}. Show the score.`
              : "No trump suit yet. Show the score."
          }
          style={styles.call}
        >
          <Text style={styles.callLabel}>Trumps</Text>
          <Text
            style={[
              styles.callSuit,
              pub.trump === "hearts" || pub.trump === "diamonds"
                ? styles.callRed
                : null,
            ]}
          >
            {pub.trump ? SUIT_SYMBOL[pub.trump] : "—"}
          </Text>
          <Text style={styles.callName}>
            {pub.trump ? SUIT_NAME[pub.trump] : "not chosen"}
          </Text>
        </Pressable>

        <View style={styles.score}>
          <Text style={styles.scoreLine}>
            <Text style={self.team === 0 ? styles.mineTeam : undefined}>
              {TEAM_NAME[0]} {pub.tricks[0]}
            </Text>
            <Text style={styles.scoreDash}>  ·  </Text>
            <Text style={self.team === 1 ? styles.mineTeam : undefined}>
              {TEAM_NAME[1]} {pub.tricks[1]}
            </Text>
          </Text>
          <Text style={styles.scoreNote}>
            {pub.tricks_to_win} tricks wins · round {pub.round}
          </Text>
        </View>
      </View>

      {showScores ? (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            Rounds won — {TEAM_NAME[0]} {pub.rounds_won[0]}, {TEAM_NAME[1]}{" "}
            {pub.rounds_won[1]}
          </Text>
          <ScrollView style={styles.sheetScroll}>
            {pub.history.length === 0 ? (
              <Text style={styles.sheetNote}>
                Nothing finished yet. This is round {pub.round}.
              </Text>
            ) : (
              pub.history
                .slice()
                .reverse()
                .map((round) => (
                  <Text key={round.round} style={styles.sheetNote}>
                    Round {round.round}: {TEAM_NAME[round.winner]} won{" "}
                    {round.tricks[round.winner]}–
                    {round.tricks[round.winner === 0 ? 1 : 0]}, trumps were{" "}
                    {SUIT_NAME[round.trump].toLowerCase()}
                    {round.delegated ? ", passed to a partner" : ""}.
                  </Text>
                ))
            )}
          </ScrollView>
          <Button label="Close" onPress={() => setShowScores(false)} />
        </View>
      ) : null}

      {/* The trick. Four seats, you at the bottom, your partner opposite,
          exactly as you would be sitting. */}
      <View style={styles.felt}>
        <Seat
          who={nameOf(ring.top)}
          cards={seatOf(ring.top)?.cards ?? 0}
          card={playedBy(ring.top)}
          turn={pub.turn === ring.top}
          partner
          width={Math.min(60, Math.round(width * 0.15))}
        />
        <View style={styles.middleRow}>
          <Seat
            who={nameOf(ring.left)}
            cards={seatOf(ring.left)?.cards ?? 0}
            card={playedBy(ring.left)}
            turn={pub.turn === ring.left}
            width={Math.min(60, Math.round(width * 0.15))}
          />
          <View style={styles.centre}>
            <Text style={styles.waiting}>
              {waitingFor(pub, self, nameOf)}
            </Text>
            {pub.lead_suit ? (
              <Text style={styles.lead}>
                Led {SUIT_NAME[pub.lead_suit].toLowerCase()}{" "}
                {SUIT_SYMBOL[pub.lead_suit]}
              </Text>
            ) : null}
          </View>
          <Seat
            who={nameOf(ring.right)}
            cards={seatOf(ring.right)?.cards ?? 0}
            card={playedBy(ring.right)}
            turn={pub.turn === ring.right}
            width={Math.min(60, Math.round(width * 0.15))}
          />
        </View>
        <View style={styles.mine}>
          {playedBy(ring.bottom) ? (
            <Card
              code={cardCode(playedBy(ring.bottom)!)}
              width={Math.min(60, Math.round(width * 0.15))}
            />
          ) : null}
        </View>
      </View>

      {notice ? <Notice text={notice} /> : null}

      {/* What you can do now. The suit choice and the ready button take
          the same place as the hand, so your thumb never has to move. */}
      {self.may_choose ? (
        <View style={styles.actions}>
          <Text style={styles.actionsTitle}>
            {pub.delegated
              ? "Your partner passed the choice to you"
              : "Name the trump suit"}
          </Text>
          <View style={styles.suits}>
            {SUITS.map((suit) => (
              <Pressable
                key={suit}
                onPress={() => void act("choose_trump", { suit }, suit)}
                disabled={sending !== null}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${SUIT_NAME[suit]}`}
                style={({ pressed }) => [
                  styles.suit,
                  pressed && styles.suitPressed,
                  sending === suit && styles.suitChosen,
                ]}
              >
                <Text
                  style={[
                    styles.suitMark,
                    (suit === "hearts" || suit === "diamonds") && styles.callRed,
                  ]}
                >
                  {SUIT_SYMBOL[suit]}
                </Text>
                <Text style={styles.suitName}>{SUIT_NAME[suit]}</Text>
              </Pressable>
            ))}
          </View>
          {self.may_delegate ? (
            <Button
              label="Pass the choice to my partner"
              onPress={() => void act("delegate_trump")}
              disabled={sending !== null}
              accessibilityHint="They choose instead, without seeing your cards"
            />
          ) : null}
          <Text style={styles.handNote}>
            Your five cards are below. The other eight come after the suit is
            named.
          </Text>
        </View>
      ) : null}

      {pub.stage === "completed_round" || pub.stage === "waiting_for_readiness" ? (
        <View style={styles.actions}>
          <Text style={styles.actionsTitle}>
            {pub.history.length
              ? `${TEAM_NAME[pub.history[pub.history.length - 1].winner]} won the round`
              : "Round over"}
          </Text>
          <Button
            label={
              seatOf(self.seat)?.ready ? "Waiting for the others" : "Ready"
            }
            tone={seatOf(self.seat)?.ready ? "quiet" : "primary"}
            onPress={() => void act("ready_round")}
            disabled={sending !== null || seatOf(self.seat)?.ready}
          />
          <Text style={styles.handNote}>
            {pub.players.filter((p) => p.ready).length} of {pub.players.length}{" "}
            ready for the next round.
          </Text>
        </View>
      ) : null}

      {/* Your hand. Overlapped when it has to be, never so far that a
          corner cannot be read. */}
      <View style={styles.handArea}>
        <Text style={styles.handNote}>
          {myTurn
            ? "Tap a card to play it."
            : hand.length === 0
              ? "No cards left."
              : `${hand.length} cards`}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hand}
        >
          {hand.map((id, index) => {
            const legal = self.legal.includes(id);
            return (
              <View
                key={id}
                style={
                  index === 0
                    ? undefined
                    : { marginLeft: -fan.overlap, zIndex: index }
                }
              >
                <Card
                  code={cardCode(id)}
                  width={fan.width}
                  onPress={() => tapCard(id)}
                  disabled={sending === id}
                  reason={whyIllegal(id, pub, self, myTurn) ?? undefined}
                  style={legal && myTurn ? styles.playable : styles.unplayable}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// One of the other three players: their name, how many cards they are
// holding, and whatever they have put into this trick.
function Seat({
  who,
  cards,
  card,
  turn,
  partner = false,
  width,
}: {
  who: string;
  cards: number;
  card?: string;
  turn: boolean;
  partner?: boolean;
  width: number;
}) {
  return (
    <View style={[styles.seat, turn && styles.seatTurn]}>
      <Text style={styles.seatName} numberOfLines={1}>
        {who}
        {partner ? " · partner" : ""}
      </Text>
      <Text style={styles.seatCards}>
        {cards} card{cards === 1 ? "" : "s"}
      </Text>
      {card ? (
        <Card code={cardCode(card)} width={width} />
      ) : (
        <View style={[styles.empty, { width, height: Math.round(width * 1.45) }]} />
      )}
    </View>
  );
}

// A reason that arrives, is read, and leaves.
function Notice({ text: message }: { text: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.quick,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  return (
    <Animated.View style={[styles.notice, { opacity: fade }]}>
      <Text style={styles.noticeText} accessibilityLiveRegion="polite">
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  call: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: TOUCH - 10,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.line,
  },
  callLabel: { ...text.small, color: colour.creamSoft },
  callSuit: { fontSize: 20, color: colour.cream, lineHeight: 22 },
  callRed: { color: "#ef8a8a" },
  callName: { ...text.label, color: colour.cream },
  score: { flex: 1, alignItems: "flex-end" },
  scoreLine: { ...text.label, color: colour.creamSoft },
  mineTeam: { color: colour.accent, fontWeight: "800" },
  scoreDash: { color: colour.creamSoft },
  scoreNote: { ...text.small, color: colour.creamSoft },
  sheet: {
    margin: space.lg,
    marginTop: 0,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.line,
  },
  sheetTitle: { ...text.label, color: colour.cream },
  sheetScroll: { maxHeight: 150 },
  sheetNote: { ...text.small, color: colour.creamSoft, lineHeight: 18 },
  felt: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  centre: { flex: 1, alignItems: "center", gap: 2 },
  waiting: { ...text.body, color: colour.cream, textAlign: "center" },
  lead: { ...text.small, color: colour.creamSoft },
  mine: { minHeight: 8, alignItems: "center" },
  seat: {
    alignItems: "center",
    gap: 2,
    padding: space.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    maxWidth: 110,
  },
  seatTurn: { borderColor: colour.accent, backgroundColor: colour.panel },
  seatName: { ...text.small, color: colour.cream, fontWeight: "700" },
  seatCards: { ...text.small, color: colour.creamSoft },
  empty: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.14)",
  },
  notice: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(194,85,63,0.18)",
    borderWidth: 1,
    borderColor: colour.danger,
  },
  noticeText: { ...text.small, color: colour.cream, lineHeight: 18 },
  actions: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg,
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.line,
  },
  actionsTitle: { ...text.heading, color: colour.cream, fontSize: 17 },
  suits: { flexDirection: "row", gap: space.sm },
  suit: {
    flex: 1,
    minHeight: TOUCH + 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: colour.panel,
  },
  suitPressed: { opacity: 0.8 },
  suitChosen: { borderColor: colour.accent, backgroundColor: "rgba(239,192,73,0.18)" },
  suitMark: { fontSize: 22, color: colour.cream },
  suitName: { ...text.small, color: colour.creamSoft },
  handArea: {
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: colour.line,
    backgroundColor: colour.feltDeep,
  },
  handNote: { ...text.small, color: colour.creamSoft, paddingHorizontal: space.lg },
  hand: { paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: 4 },
  playable: {},
  unplayable: { opacity: 0.45 },
});
