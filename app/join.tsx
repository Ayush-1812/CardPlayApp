// Arriving at somebody else's room.
//
// Three ways in, because a group will use all three: the link opened
// straight from WhatsApp, a link pasted in by hand, and a code read out
// across a room. Whichever it is, the person tapping it may never have
// opened this app before, so a guest account is made on the spot rather
// than asking them to sign up first.

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { joinWithToken } from "../src/api";
import { Button, PrimaryButton } from "../src/components/button";
import { Screen } from "../src/components/screen";
import { inviteTokenFrom } from "../src/invite";
import { useSession } from "../src/session";
import { colour, radius, space, TOUCH, type as text } from "../src/theme";

export default function Join() {
  const { token: fromLink } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { token, user, signInAsGuest } = useSession();
  const [typed, setTyped] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // What was typed might be a whole link, so the token is pulled out of it
  // either way.
  const invite = (fromLink || inviteTokenFrom(typed) || typed).trim();

  const join = useCallback(
    async (invitation: string, as?: string) => {
      if (!invitation) {
        setError("Paste the invite link, or type the code.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        // Somebody arriving from a link has no account yet. One is made
        // for them here, under whatever name they gave.
        let session = token;
        if (!session) {
          session = await signInAsGuest(as?.trim() || "Guest");
          if (!session) {
            setError("Could not make you a guest account. Try again.");
            return;
          }
        }
        const joined = await joinWithToken(session, invitation);
        router.replace(`/room/${joined.room_id}`);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "That invitation did not work. Ask for a new link.",
        );
      } finally {
        setBusy(false);
      }
    },
    [token, signInAsGuest, router],
  );

  // A link opened from a chat should land in the room, not on a form --
  // but only once there is somebody to join as.
  useEffect(() => {
    if (fromLink && token) void join(fromLink, undefined);
  }, [fromLink, token, join]);

  if (fromLink && token)
    return (
      <Screen title="Joining">
        <View style={styles.middle}>
          <ActivityIndicator color={colour.accent} />
          <Text style={styles.note}>{error || "Taking you to the room…"}</Text>
          {error ? (
            <Button label="Back" onPress={() => router.replace("/games")} full={false} />
          ) : null}
        </View>
      </Screen>
    );

  return (
    <Screen
      title="Join a game"
      subtitle="Paste the link you were sent, or type the code"
    >
      <View style={styles.body}>
        {!token ? (
          <View style={styles.field}>
            <Text style={styles.label}>Your name at the table</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Guest"
              placeholderTextColor={colour.creamSoft}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              returnKeyType="next"
            />
            <Text style={styles.note}>
              No account needed. This is the name the others see.
            </Text>
          </View>
        ) : (
          <Text style={styles.note}>
            Joining as {user?.display_name ?? "you"}.
          </Text>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Invite link or code</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              placeholder="Paste the link, or type the code"
              placeholderTextColor={colour.creamSoft}
              style={[styles.input, styles.grow]}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="go"
              onSubmitEditing={() => void join(invite, name)}
            />
            <Button
              label="Paste"
              full={false}
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                if (text) setTyped(text.trim());
              }}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={busy ? "Joining…" : "Take my seat"}
          onPress={() => void join(invite, name)}
          disabled={busy || !invite}
        />
        <Text style={styles.note}>
          A link sent on WhatsApp opens this screen on its own. The code is
          for when somebody is reading it out to you.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  body: { padding: space.lg, gap: space.lg },
  field: { gap: space.sm },
  label: {
    ...text.label,
    color: colour.creamSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inputRow: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  grow: { flex: 1 },
  input: {
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: colour.panelSolid,
    color: colour.cream,
    fontSize: 16,
  },
  note: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
  error: { ...text.small, color: colour.dangerInk },
});
