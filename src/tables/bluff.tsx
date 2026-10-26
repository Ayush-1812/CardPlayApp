// Bluff on a phone.
//
// Two things make this table hard on a small screen. The first is that
// your own hand is enormous -- everybody is dealt the whole deck between
// them -- so it scrolls and overlaps and still has to be tappable. The
// second is the five-second window: the moment somebody plays, every
// other player has to notice, understand and answer before it closes.
// That window gets the loudest thing on the screen.

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
import {
  cardCode,
  declaration,
  deckOf,
  rankWord,
  revealSentence,
  secondsLeft,
  sortHand,
  type BluffView,
} from "../bluff";
import { Button, PrimaryButton } from "../components/button";
import { Card, fanWidth } from "../components/card";
import type { MatchState } from "../live";
import { colour, radius, space, TOUCH, type as text } from "../theme";

type Send = (kind: string, payload?: unknown) => Promise<string | null>;

export function BluffTable({
  match,
  send,
}: {
  match: MatchState;
  send: Send;
}) {
  const view = match.view as BluffView | undefined;
  const { width } = useWindowDimensions();
  const [chosen, setChosen] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  const pub = view?.public;
  const self = view?.self;

  // The countdown runs locally so it moves every second rather than
  // whenever the server next says something. Whether an answer was in
  // time is still entirely the server's decision.
  useEffect(() => {
    if (!pub?.deadline) {
      setLeft(0);
      return;
    }
    setLeft(secondsLeft(pub.deadline));
    const timer = setInterval(
      () => setLeft(secondsLeft(pub.deadline)),
      250,
    );
    return () => clearInterval(timer);
  }, [pub?.deadline]);

  // A play of your own clears the selection; so does the call moving on.
  useEffect(() => {
    setChosen([]);
  }, [pub?.last?.id, pub?.rank]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!view || !pub || !self)
    return (
      <View style={styles.middle}>
        <Text style={styles.line}>Dealing…</Text>
      </View>
    );

  const hand = sortHand(self.hand);
  const fan = fanWidth(hand.length, width - space.lg * 2, 64);
  const nameOf = (seat: number) =>
    match.participants?.find((p) => p.seat === seat)?.display_name ??
    `Seat ${seat + 1}`;
  const myTurn = self.may_play && pub.phase === "play";
  const canAnswer = self.may_answer && !!self.answer_id;
  const limit = pub.max_cards || 4;

  async function act(kind: string, payload?: unknown) {
    setBusy(true);
    const problem = await send(kind, payload);
    setBusy(false);
    if (problem) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNotice(problem);
    }
  }

  function toggle(id: string) {
    setChosen((was) => {
      if (was.includes(id)) return was.filter((c) => c !== id);
      if (was.length >= limit) {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        setNotice(`You can play at most ${limit} cards at once.`);
        return was;
      }
      void Haptics.selectionAsync();
      return [...was, id];
    });
  }

  return (
    <View style={styles.table}>
      {/* The call and the pile, across the top, out of the way of the
          hand. */}
      <View style={styles.top}>
        <View style={styles.call}>
          <Text style={styles.callLabel}>Call</Text>
          <Text style={styles.callRank}>{rankWord(pub.rank, true)}</Text>
        </View>
        <View style={styles.pile}>
          <Text style={styles.pileCount}>{pub.pile_count}</Text>
          <Text style={styles.pileLabel}>
            card{pub.pile_count === 1 ? "" : "s"} in the pile
          </Text>
        </View>
      </View>

      {/* Everyone else, and how much trouble they are in. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.players}
      >
        {pub.counts.map((count, seat) =>
          seat === self.seat ? null : (
            <View
              key={seat}
              style={[
                styles.player,
                pub.turn === seat && styles.playerTurn,
                pub.phase === "challenge" && pub.accepted[seat] && styles.playerDone,
              ]}
            >
              <Text style={styles.playerName} numberOfLines={1}>
                {nameOf(seat)}
              </Text>
              <Text style={styles.playerCards}>
                {count} card{count === 1 ? "" : "s"}
              </Text>
              {pub.phase === "challenge" ? (
                <Text style={styles.playerState}>
                  {pub.accepted[seat] ? "accepted" : "deciding"}
                </Text>
              ) : null}
            </View>
          ),
        )}
      </ScrollView>

      <View style={styles.felt}>
        {/* What just happened, or what is happening now. */}
        {pub.result ? (
          <View style={styles.reveal}>
            <Text style={styles.revealLine}>
              {revealSentence(pub.result, nameOf, self.seat)}
            </Text>
            <View style={styles.revealCards}>
              {pub.result.cards.map((id, i) => (
                <Card key={`${id}-${i}`} code={cardCode(id)} width={44} />
              ))}
            </View>
            <Text style={styles.revealNote}>
              Called as {rankWord(pub.result.claimed, true).toLowerCase()}.
            </Text>
          </View>
        ) : pub.last ? (
          <View style={styles.claim}>
            <View style={styles.claimCards}>
              {Array.from({ length: Math.min(pub.last.count, 6) }).map((_, i) => (
                <View key={i} style={i === 0 ? undefined : styles.stacked}>
                  <Card down width={48} />
                </View>
              ))}
            </View>
            <Text style={styles.claimLine}>
              {declaration(
                pub.last.seat === self.seat ? "You" : nameOf(pub.last.seat),
                pub.last,
              )}
            </Text>
          </View>
        ) : (
          <Text style={styles.line}>
            {myTurn
              ? `Your turn. Put down up to ${limit}, called as ${rankWord(pub.rank, true).toLowerCase()}.`
              : `${nameOf(pub.turn)} is playing ${rankWord(pub.rank, true).toLowerCase()}.`}
          </Text>
        )}
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        </View>
      ) : null}

      {/* The window. Five seconds is not long enough to go looking for a
          button, so it arrives under the thumb and counts down in place. */}
      {canAnswer ? (
        <Window
          seconds={left}
          who={pub.last ? nameOf(pub.last.seat) : "Someone"}
          claim={pub.last}
          busy={busy}
          onAccept={() => void act("accept_play", { play_id: self.answer_id })}
          onChallenge={() => void act("call_bluff", { play_id: self.answer_id })}
        />
      ) : pub.phase === "challenge" ? (
        <View style={styles.waitRow}>
          <Text style={styles.waitText}>
            {pub.pending > 0
              ? `Waiting on ${pub.pending} player${pub.pending === 1 ? "" : "s"}…`
              : "Resolving…"}
          </Text>
          {left > 0 ? <Text style={styles.waitClock}>{left}s</Text> : null}
        </View>
      ) : null}

      {/* Your hand, and the one button that plays from it. */}
      <View style={styles.handArea}>
        <View style={styles.handTop}>
          <Text style={styles.handNote}>
            {hand.length} card{hand.length === 1 ? "" : "s"}
            {chosen.length ? ` · ${chosen.length} chosen` : ""}
          </Text>
          {chosen.length ? (
            <Pressable onPress={() => setChosen([])} hitSlop={8}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hand}
        >
          {hand.map((id, index) => (
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
                selected={chosen.includes(id)}
                onPress={() => toggle(id)}
                disabled={!myTurn}
                reason={
                  myTurn
                    ? undefined
                    : `It is ${nameOf(pub.turn)}'s turn — you cannot play yet.`
                }
              />
              {deckOf(id) > 1 ? (
                <Text style={styles.deckMark}>{deckOf(id)}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
        <View style={styles.playRow}>
          <PrimaryButton
            label={
              !myTurn
                ? `${nameOf(pub.turn)} to play`
                : chosen.length === 0
                  ? `Choose 1 to ${limit} cards`
                  : `Play ${chosen.length} as ${rankWord(pub.rank, chosen.length !== 1).toLowerCase()}`
            }
            onPress={() => void act("play_cards", { cards: chosen })}
            disabled={!myTurn || chosen.length === 0 || busy}
            accessibilityHint="Nobody sees them unless someone challenges"
          />
        </View>
      </View>
    </View>
  );
}

// The five-second window: a countdown bar and two answers, nothing else
// to read.
function Window({
  seconds,
  who,
  claim,
  busy,
  onAccept,
  onChallenge,
}: {
  seconds: number;
  who: string;
  claim?: { count: number; rank_name: string };
  busy: boolean;
  onAccept: () => void;
  onChallenge: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  // The bar drains rather than the number ticking, because a bar is read
  // without being looked at.
  const span = Math.max(seconds, 0);
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={styles.window}>
      <View style={styles.windowHead}>
        <Text style={styles.windowText} numberOfLines={2}>
          {who} played {claim?.count ?? 0} {claim?.rank_name ?? "cards"}
        </Text>
        <Animated.Text
          style={[
            styles.windowClock,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
          ]}
        >
          {span}s
        </Animated.Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { flex: Math.min(span, 5) }]} />
        <View style={{ flex: Math.max(0, 5 - span) }} />
      </View>
      <View style={styles.windowButtons}>
        <Button
          label="Accept"
          onPress={onAccept}
          disabled={busy}
          full={false}
          style={styles.grow}
          accessibilityHint="Let the play stand. This cannot be undone."
        />
        <Button
          label="Call bluff"
          tone="danger"
          onPress={onChallenge}
          disabled={busy}
          full={false}
          style={styles.grow}
          accessibilityHint="Turn those cards over. Whoever is wrong takes the pile."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flex: 1 },
  middle: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  call: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    minHeight: TOUCH - 12,
    borderRadius: radius.pill,
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.accent,
  },
  callLabel: {
    ...text.small,
    color: colour.creamSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  callRank: { ...text.heading, color: colour.accent, fontSize: 18 },
  pile: { alignItems: "flex-end" },
  pileCount: { ...text.heading, color: colour.cream },
  pileLabel: { ...text.small, color: colour.creamSoft },
  players: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  player: {
    minWidth: 92,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colour.panel,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 1,
  },
  playerTurn: { borderColor: colour.accent },
  playerDone: { opacity: 0.55 },
  playerName: { ...text.label, color: colour.cream },
  playerCards: { ...text.small, color: colour.creamSoft },
  playerState: { ...text.small, color: colour.accent },
  felt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  line: { ...text.body, color: colour.cream, textAlign: "center", lineHeight: 21 },
  claim: { alignItems: "center", gap: space.sm },
  claimCards: { flexDirection: "row" },
  stacked: { marginLeft: -34 },
  claimLine: { ...text.body, color: colour.cream, textAlign: "center" },
  reveal: { alignItems: "center", gap: space.sm },
  revealLine: {
    ...text.body,
    color: colour.cream,
    textAlign: "center",
    lineHeight: 21,
  },
  revealCards: { flexDirection: "row", gap: space.xs, flexWrap: "wrap", justifyContent: "center" },
  revealNote: { ...text.small, color: colour.creamSoft },
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
  window: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colour.panelSolid,
    borderWidth: 2,
    borderColor: colour.accent,
  },
  windowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  windowText: { ...text.body, color: colour.cream, flex: 1 },
  windowClock: {
    ...text.heading,
    color: colour.accent,
    fontVariant: ["tabular-nums"],
  },
  bar: {
    flexDirection: "row",
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  barFill: { backgroundColor: colour.accent },
  windowButtons: { flexDirection: "row", gap: space.sm },
  grow: { flexGrow: 1, flexBasis: 100 },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  waitText: { ...text.small, color: colour.creamSoft },
  waitClock: {
    ...text.label,
    color: colour.accent,
    fontVariant: ["tabular-nums"],
  },
  handArea: {
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
    borderTopWidth: 1,
    borderTopColor: colour.line,
    backgroundColor: colour.feltDeep,
  },
  handTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
  },
  handNote: { ...text.small, color: colour.creamSoft },
  clear: { ...text.small, color: colour.accent, padding: space.xs },
  hand: { paddingHorizontal: space.lg, paddingTop: 14, paddingBottom: 4 },
  deckMark: {
    position: "absolute",
    bottom: 2,
    right: 4,
    ...text.small,
    fontSize: 10,
    color: colour.cardInk,
    opacity: 0.6,
  },
  playRow: { paddingHorizontal: space.lg, paddingTop: space.xs },
});
