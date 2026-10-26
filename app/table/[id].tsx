// The table. Which game is on it is the server's business, so this screen
// only does what every game needs: hold the subscription, say whether the
// connection is alive, send commands, and get out of the way.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/button";
import { gameByID } from "../../src/games";
import { commandError, useLive } from "../../src/live";
import { CONNECTION_WORDS } from "../../src/realtime";
import { TrumpTable } from "../../src/tables/trump";
import { colour, radius, space, TOUCH, type as text } from "../../src/theme";

export default function Table() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { connection, match, room, watch, command } = useLive();

  // Watching a match keeps the room subscription alive underneath it, so
  // the chat, the other players' readiness and -- once it is running --
  // the voice channel all carry on between games.
  useEffect(() => {
    if (!id) return;
    watch({ roomID: room?.room.id, matchID: id });
  }, [id, room?.room.id, watch]);

  const send = useCallback(
    async (kind: string, payload?: unknown): Promise<string | null> => {
      if (!match) return "The table is not ready yet.";
      const reply = await command({
        kind,
        payload,
        expectedRevision: match.revision,
      });
      return commandError(reply);
    },
    [command, match],
  );

  const live = connection === "live";
  const game = gameByID(match?.game_id);

  function leave() {
    if (room?.room.id) router.replace(`/room/${room.room.id}`);
    else router.replace("/games");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {/* A thin strip: leaving, what game this is, and whether the table
          can hear you. Nothing else earns space above the cards. */}
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave the table"
          onPress={leave}
          hitSlop={8}
          style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
        >
          <Text style={styles.leaveMark}>←</Text>
        </Pressable>
        <Text style={styles.game} numberOfLines={1}>
          {game?.name ?? "Table"}
        </Text>
        <View style={[styles.chip, live && styles.chipLive]}>
          <View style={[styles.pip, live && styles.pipLive]} />
          <Text style={styles.chipText} numberOfLines={1}>
            {live ? "Live" : CONNECTION_WORDS[connection]}
          </Text>
        </View>
      </View>

      {!match || match.match_id !== id ? (
        <View style={styles.middle}>
          <ActivityIndicator color={colour.accent} />
          <Text style={styles.note}>
            {connection === "live"
              ? "Taking your seat…"
              : CONNECTION_WORDS[connection]}
          </Text>
          {connection === "replaced" || connection === "gone" ? (
            <Button label="Back to the room" onPress={leave} full={false} />
          ) : null}
        </View>
      ) : match.status === "finished" || match.status === "abandoned" ? (
        <View style={styles.middle}>
          <Text style={styles.over}>
            {match.status === "abandoned" ? "Game abandoned" : "Game over"}
          </Text>
          <Text style={styles.note}>
            {match.winner_id
              ? `${nameFor(match.winner_id, match.participants)} won.`
              : match.end_reason === "abandoned"
                ? "The table agreed to stop."
                : "That is the end of this one."}
          </Text>
          {/* The room is still there, with everyone in it. Another game
              starts from the same seats. */}
          <Button label="Back to the room" onPress={leave} full={false} />
        </View>
      ) : match.game_id === "trump" ? (
        <TrumpTable match={match} send={send} />
      ) : (
        <View style={styles.middle}>
          <Text style={styles.over}>{game?.name ?? "This game"}</Text>
          <Text style={styles.note}>
            This table is not in the app yet. It is playable on the website
            in the meantime.
          </Text>
          <Button label="Back to the room" onPress={leave} full={false} />
        </View>
      )}
    </SafeAreaView>
  );
}

function nameFor(
  userID: string,
  participants: { user_id: string; display_name: string }[] | undefined,
): string {
  return (
    participants?.find((p) => p.user_id === userID)?.display_name ?? "Someone"
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.feltDark },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  leave: {
    width: TOUCH - 8,
    height: TOUCH - 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.panel,
  },
  pressed: { opacity: 0.7 },
  leaveMark: { color: colour.cream, fontSize: 20, lineHeight: 22 },
  game: { ...text.label, color: colour.cream, flex: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colour.panel,
    maxWidth: 150,
  },
  chipLive: { backgroundColor: "rgba(79,157,105,0.18)" },
  chipText: { ...text.small, color: colour.creamSoft },
  pip: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colour.creamSoft,
  },
  pipLive: { backgroundColor: colour.good },
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  over: { ...text.heading, color: colour.cream },
  note: {
    ...text.body,
    color: colour.creamSoft,
    textAlign: "center",
    lineHeight: 21,
  },
});
