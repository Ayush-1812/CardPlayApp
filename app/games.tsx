// Choosing a game. Each tile says what the game is in one line, offers the
// rules to anyone who has not played it, and makes a room in one tap.

import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/screen";
import { createRoom } from "../src/api";
import { GAMES } from "../src/games";
import { useSession } from "../src/session";
import { colour, radius, space, type as text } from "../src/theme";

export default function Games() {
  const { token, user } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function newRoom(game: { id: string; name: string; seats: number }) {
    if (!token || !user || busy) return;
    setBusy(game.id);
    setError("");
    try {
      const room = await createRoom(token, {
        name: `${user.display_name}'s table`,
        capacity: game.seats,
        game: game.id,
      });
      router.push(`/room/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make a room.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      title={`Hi, ${user?.display_name ?? "there"}`}
      subtitle="Pick a game and send the link to your group."
      back={false}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {GAMES.map((game) => (
          <View key={game.id} style={styles.tile}>
            <View style={styles.tileHead}>
              <Text style={styles.name}>{game.name}</Text>
              <Text style={styles.suit}>{game.suit}</Text>
            </View>
            <Text style={styles.blurb}>{game.blurb}</Text>
            <Text style={styles.players}>
              {game.players}
              {game.playable ? "" : " · coming soon"}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`How to play ${game.name}`}
                onPress={() => router.push(`/learn/${game.id}`)}
                style={({ pressed }) => [styles.quiet, pressed && styles.pressed]}
              >
                <Text style={styles.quietLabel}>How to play</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Start a ${game.name} room`}
                disabled={!game.playable || busy !== null}
                onPress={() => void newRoom(game)}
                style={({ pressed }) => [
                  styles.go,
                  !game.playable && styles.off,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.goLabel}>
                  {busy === game.id ? "Making a room…" : "New room"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  error: { ...text.small, color: colour.dangerInk },
  tile: {
    backgroundColor: colour.panelSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    gap: space.sm,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { ...text.heading, color: colour.cream, flex: 1 },
  suit: { fontSize: 22, color: colour.accent },
  blurb: { ...text.body, color: colour.creamSoft, lineHeight: 21 },
  players: { ...text.small, color: colour.creamSoft, opacity: 0.8 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  quiet: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    alignItems: "center",
    justifyContent: "center",
  },
  quietLabel: { ...text.label, color: colour.cream },
  go: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colour.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  goLabel: { ...text.label, color: colour.accentInk, fontWeight: "800" },
  off: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
});
