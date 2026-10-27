// The way in. One field and one button: a name, and a seat at a table.
// Signing in with an account comes later; a guest can play straight away.

import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../src/components/button";
import { inviteTokenFrom } from "../src/invite";
import { useSession } from "../src/session";
import { colour, radius, space, type as text, TOUCH } from "../src/theme";

export default function Entry() {
  const { ready, user, busy, error, signInAsGuest } = useSession();
  const [name, setName] = useState("");
  const router = useRouter();
  const url = Linking.useURL();

  // Already signed in from last time: go straight to the games -- unless
  // the app was opened by an invite, which is being taken somewhere else
  // and must not be overtaken by this.
  useEffect(() => {
    if (!ready || !user) return;
    if (url && inviteTokenFrom(url)) return;
    router.replace("/games");
  }, [ready, user, url, router]);

  if (!ready)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colour.accent} />
      </View>
    );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.brand}>♣ CardPlay</Text>
          <Text style={styles.tagline}>
            Card games with your people. Make a room, send the link, play.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Your name at the table</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ayush"
            placeholderTextColor={colour.creamSoft}
            style={styles.input}
            maxLength={24}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => void signInAsGuest(name)}
            accessibilityLabel="Your name at the table"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={busy ? "Taking your seat…" : "Play as guest"}
            onPress={() => void signInAsGuest(name)}
            disabled={busy || name.trim().length === 0}
          />
          <Text style={styles.note}>
            No account needed. Your name is what the table sees.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colour.feltDark },
  fill: { flex: 1, justifyContent: "center", padding: space.lg },
  loading: {
    flex: 1,
    backgroundColor: colour.feltDark,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { marginBottom: space.xl, gap: space.sm },
  brand: { ...text.title, color: colour.cream, letterSpacing: -0.5 },
  tagline: { ...text.body, color: colour.creamSoft, lineHeight: 22 },
  card: {
    backgroundColor: colour.panelSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    gap: space.md,
  },
  label: { ...text.label, color: colour.creamSoft },
  input: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: space.md,
    color: colour.cream,
    fontSize: 17,
  },
  error: { ...text.small, color: colour.dangerInk },
  note: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
});
