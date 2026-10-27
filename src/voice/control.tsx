// The voice control, up in the top bar.
//
// It lives beside the trump card rather than anywhere near the hand,
// because a control that sits over the cards is a control that hides the
// cards -- which is exactly the complaint it was moved for on the
// website. Two taps are all it is: one to talk, one to mute. Everything
// else is in the sheet behind it, where it does not cost any space.

import * as Haptics from "expo-haptics";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, PrimaryButton } from "../components/button";
import type { Participant } from "../live";
import { colour, radius, space, TOUCH, type as text } from "../theme";
import type { useVoice } from "./use-voice";

type Channel = ReturnType<typeof useVoice>;

export function VoiceControl({
  voice,
  participants,
  selfID,
}: {
  voice: Channel;
  participants: Participant[] | undefined;
  selfID: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const { status, policy, muted, speaking } = voice;
  const others = voice.participants.filter((p) => p.user_id !== selfID).length;

  const nameOf = (userID: string) =>
    participants?.find((p) => p.user_id === userID)?.display_name ?? "A player";

  // Not in the call yet: one button, and it says what it does.
  if (status !== "live")
    return (
      <>
        <Pressable
          onPress={() => {
            if (!policy.open) {
              setOpen(true);
              return;
            }
            void Haptics.selectionAsync();
            void voice.join();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            policy.open ? "Join the voice call" : "Voice is closed"
          }
          hitSlop={6}
          style={({ pressed }) => [
            styles.pill,
            !policy.open && styles.pillOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.mark}>{policy.open ? "🎙" : "🔇"}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {status === "asking"
              ? "Asking…"
              : status === "joining"
                ? "Joining…"
                : status === "unavailable"
                  ? "No voice"
                  : status === "error"
                    ? "Try again"
                    : policy.open
                      ? "Talk"
                      : "Closed"}
          </Text>
        </Pressable>
        <Sheet
          voice={voice}
          open={open}
          onClose={() => setOpen(false)}
          nameOf={nameOf}
          selfID={selfID}
        />
      </>
    );

  return (
    <>
      <View style={styles.group}>
        {/* The mute button is the one people reach for mid-game, so it is
            the big half of the control. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            voice.setMuted(!muted);
          }}
          accessibilityRole="button"
          accessibilityLabel={muted ? "Unmute yourself" : "Mute yourself"}
          accessibilityState={{ selected: muted }}
          hitSlop={6}
          style={({ pressed }) => [
            styles.pill,
            muted ? styles.pillMuted : speaking && styles.pillSpeaking,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.mark}>{muted ? "🔇" : "🎙"}</Text>
          <Text style={styles.label}>{muted ? "Muted" : "Live"}</Text>
        </Pressable>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Voice: ${others} other${others === 1 ? "" : "s"} in the call`}
          hitSlop={6}
          style={({ pressed }) => [styles.count, pressed && styles.pressed]}
        >
          <Text style={styles.countText}>{others + 1}</Text>
        </Pressable>
      </View>
      <Sheet
        voice={voice}
        open={open}
        onClose={() => setOpen(false)}
        nameOf={nameOf}
        selfID={selfID}
      />
    </>
  );
}

// Everything that does not earn a place in the bar: who is in the call,
// whether each link is up, deafen, and leaving.
function Sheet({
  voice,
  open,
  onClose,
  nameOf,
  selfID,
}: {
  voice: Channel;
  open: boolean;
  onClose: () => void;
  nameOf: (id: string) => string;
  selfID: string | undefined;
}) {
  const { status, policy, error, deafened, links } = voice;
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Voice</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>

          {!policy.open ? (
            <Text style={styles.note}>
              {policy.reason ??
                "The game has closed voice for a moment. It opens again by itself."}
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {status === "live" ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listBody}>
              {voice.participants.map((p) => {
                const link = p.user_id === selfID ? "connected" : links[p.user_id];
                return (
                  <View key={p.user_id} style={styles.row}>
                    <Text style={styles.who} numberOfLines={1}>
                      {p.user_id === selfID ? "You" : nameOf(p.user_id)}
                    </Text>
                    <Text
                      style={[
                        styles.state,
                        p.speaking && !p.muted ? styles.talking : null,
                      ]}
                    >
                      {p.muted
                        ? "muted"
                        : p.speaking
                          ? "talking"
                          : p.user_id === selfID
                            ? "listening"
                            : linkWords(link)}
                    </Text>
                  </View>
                );
              })}
              {voice.participants.length <= 1 ? (
                <Text style={styles.note}>
                  Nobody else has joined the call yet. They can still hear the
                  game without it.
                </Text>
              ) : null}
            </ScrollView>
          ) : null}

          {status === "live" ? (
            <>
              <Button
                label={deafened ? "Turn sound back on" : "Mute everyone"}
                tone={deafened ? "primary" : "quiet"}
                onPress={() => voice.setDeafened(!deafened)}
                accessibilityHint="Stops you hearing the others, and them hearing you"
              />
              <Button label="Leave the call" tone="danger" onPress={voice.leave} />
            </>
          ) : (
            <PrimaryButton
              label={status === "unavailable" ? "Voice unavailable" : "Join the call"}
              onPress={() => void voice.join()}
              disabled={status === "unavailable" || !policy.open}
            />
          )}
          <Text style={styles.note}>
            Audio goes straight between players. The server only passes on
            the introductions, and nothing is recorded.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// A connection state in words a player can act on.
function linkWords(state: string | undefined): string {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
    case "new":
      return "connecting…";
    case "failed":
    case "disconnected":
      return "reconnecting…";
    case "closed":
      return "gone";
    default:
      return "connecting…";
  }
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", alignItems: "center", gap: 4 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: TOUCH - 12,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colour.panel,
    borderWidth: 1,
    borderColor: colour.line,
  },
  pillOff: { opacity: 0.6 },
  pillMuted: { borderColor: colour.danger, backgroundColor: "rgba(194,85,63,0.18)" },
  pillSpeaking: { borderColor: colour.good, backgroundColor: "rgba(79,157,105,0.2)" },
  pressed: { opacity: 0.8 },
  mark: { fontSize: 14 },
  label: { ...text.small, color: colour.cream, fontWeight: "700" },
  count: {
    minWidth: TOUCH - 18,
    height: TOUCH - 12,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.panel,
    borderWidth: 1,
    borderColor: colour.line,
  },
  countText: { ...text.small, color: colour.creamSoft, fontWeight: "800" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetWrap: { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colour.feltDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
    maxHeight: "80%",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...text.heading, color: colour.cream, fontSize: 17 },
  close: { ...text.label, color: colour.accent, padding: space.xs },
  list: { maxHeight: 220 },
  listBody: { gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    minHeight: 32,
  },
  who: { ...text.body, color: colour.cream, flex: 1 },
  state: { ...text.small, color: colour.creamSoft },
  talking: { color: colour.good, fontWeight: "700" },
  note: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
  error: { ...text.small, color: colour.dangerInk, lineHeight: 17 },
});
