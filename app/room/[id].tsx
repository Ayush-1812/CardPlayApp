// The room: who is here, who is ready, and how to get the rest of your
// group into it. Everything about this screen is about the thirty seconds
// between deciding to play and playing.

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createInvitation, setReady, startMatch } from "../../src/api";
import { Button, PrimaryButton } from "../../src/components/button";
import { ChatButton, ChatSheet, useChat } from "../../src/components/chat";
import { RoomSettings } from "../../src/components/room-settings";
import { Screen } from "../../src/components/screen";
import { gameByID } from "../../src/games";
import {
  canOpenWhatsApp,
  inviteLink,
  inviteMessage,
  roomCode,
  whatsappURL,
} from "../../src/invite";
import { useLive } from "../../src/live";
import { CONNECTION_WORDS } from "../../src/realtime";
import { useSession } from "../../src/session";
import { VoiceControl } from "../../src/voice/control";
import { useVoiceChannel } from "../../src/voice/provider";
import { colour, radius, space, TOUCH, type as text } from "../../src/theme";

export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useSession();
  const router = useRouter();
  const { connection, room: view, watch, refreshRoom } = useLive();
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasWhatsApp, setHasWhatsApp] = useState(false);
  const voice = useVoiceChannel();
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chat = useChat(view?.room.id, chatOpen);

  // The socket follows the room. It is held above this screen, so walking
  // into a game and back out again does not rebuild it.
  useEffect(() => {
    if (!id) return;
    watch({ roomID: id });
    void refreshRoom();
  }, [id, watch, refreshRoom]);

  // One invitation per visit is enough: the same link works until the room
  // fills.
  useEffect(() => {
    if (!token || !id || invite) return;
    let alive = true;
    void (async () => {
      try {
        const made = await createInvitation(token, id);
        if (alive) setInvite(made.token);
      } catch {
        // Not fatal. The room still works; there is just nothing to share
        // until this succeeds on a later pass.
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, id, invite]);

  useEffect(() => {
    void canOpenWhatsApp().then(setHasWhatsApp);
  }, []);

  // When the host starts, everyone follows.
  useEffect(() => {
    const match = view?.match;
    if (match && match.status === "playing")
      router.replace(`/table/${match.id}`);
  }, [view?.match, router]);

  if (!view || view.room.id !== id)
    return (
      <Screen title="Room">
        <View style={styles.loading}>
          <ActivityIndicator color={colour.accent} />
          <Text style={styles.note}>
            {error || CONNECTION_WORDS[connection]}
          </Text>
        </View>
      </Screen>
    );

  const game = gameByID(view.room.game_id);
  const me = view.members.find((m) => m.id === user?.id);
  const isHost = view.room.host_id === user?.id;
  const notReadyCount = view.members.filter((m) => !m.ready).length;
  const everyoneReady = view.members.length >= 2 && notReadyCount === 0;
  const link = invite ? inviteLink(invite) : "";
  const code = invite ? roomCode(invite) : "……";
  const message = inviteMessage({
    game: game?.name ?? "cards",
    host: user?.display_name ?? "A friend",
    link,
  });

  async function share(where: "whatsapp" | "sheet") {
    if (!link) return;
    void Haptics.selectionAsync();
    try {
      if (where === "whatsapp" && hasWhatsApp) {
        await Linking.openURL(whatsappURL(message));
        return;
      }
      await Share.share({ message });
    } catch {
      setError("Could not open the share sheet. The link is above to copy.");
    }
  }

  async function copy() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function toggleReady() {
    if (!token || !id || !me) return;
    setBusy(true);
    setError("");
    try {
      await setReady(token, id, !me.ready);
      await refreshRoom();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change that.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!token || !id) return;
    setBusy(true);
    setError("");
    try {
      const started = await startMatch(token, id);
      router.replace(`/table/${started.match_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={view.room.name}
      subtitle={`${game?.name ?? "Card game"} · ${view.members.length} of ${view.room.capacity} seats`}
      action={
        <View style={styles.actions}>
          <VoiceControl
            voice={voice}
            participants={view?.members.map((m) => ({
              user_id: m.id,
              seat: m.seat,
              handle: m.handle,
              display_name: m.display_name,
              connected: true,
              abandon_vote: false,
            }))}
            selfID={user?.id}
          />
          <ChatButton unread={chat.unread} onPress={() => setChatOpen(true)} />
          <View
            style={[styles.chip, connection === "live" && styles.chipLive]}
            accessibilityLabel={CONNECTION_WORDS[connection]}
          >
            <View
              style={[styles.pip, connection === "live" && styles.pipLive]}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {connection === "live" ? "Live" : CONNECTION_WORDS[connection]}
            </Text>
          </View>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Getting the group in is the whole job of this screen, so it is
            the first thing on it. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Invite your group</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeLabel}>Room code</Text>
            <Text
              style={styles.code}
              accessibilityLabel={`Room code ${code.split("").join(" ")}`}
            >
              {code}
            </Text>
          </View>
          <View style={styles.shareRow}>
            {hasWhatsApp ? (
              <PrimaryButton
                label="Send on WhatsApp"
                onPress={() => void share("whatsapp")}
                disabled={!link}
                full={false}
                style={styles.grow}
              />
            ) : null}
            <Button
              label="Share link"
              onPress={() => void share("sheet")}
              disabled={!link}
              full={false}
              style={styles.grow}
            />
            <Button
              label={copied ? "Copied" : "Copy"}
              onPress={() => void copy()}
              disabled={!link}
              full={false}
            />
          </View>
          <Text style={styles.note}>
            Anyone with the link can take a free seat. It opens the app if
            they have it, and the website if they do not.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>At the table</Text>
          {view.members.map((member) => (
            <View key={member.id} style={styles.seat}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {member.display_name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.seatWho}>
                <Text style={styles.seatName} numberOfLines={1}>
                  {member.display_name}
                  {member.id === user?.id ? " (you)" : ""}
                </Text>
                <Text style={styles.seatRole}>
                  {member.id === view.room.host_id ? "Host" : "Player"}
                </Text>
              </View>
              <Text
                style={[
                  styles.state,
                  member.ready ? styles.ready : styles.notReady,
                ]}
              >
                {member.ready ? "Ready" : "Not ready"}
              </Text>
            </View>
          ))}
          {Array.from({
            length: Math.max(0, view.room.capacity - view.members.length),
          }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.seat, styles.empty]}>
              <View style={[styles.avatar, styles.avatarEmpty]} />
              <Text style={styles.seatEmpty}>Empty seat</Text>
            </View>
          ))}
        </View>

        {game ? (
          <Button
            label={`How to play ${game.name}`}
            onPress={() => router.push(`/learn/${game.id}`)}
          />
        ) : null}

        {isHost ? (
          <Button
            label="Change game or settings"
            onPress={() => setSettingsOpen(true)}
            accessibilityHint="The game, the name, the seats, and how many decks"
          />
        ) : (
          <Text style={styles.note}>
            {game?.decks && view.room.deck_count > 1
              ? `Playing with ${view.room.deck_count} decks.`
              : ""}
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {/* The two things you might do next, where a thumb already is. */}
      <View style={styles.footer}>
        <Button
          label={me?.ready ? "Not ready" : "I'm ready"}
          tone={me?.ready ? "quiet" : "primary"}
          onPress={() => void toggleReady()}
          disabled={busy || !me}
          accessibilityHint="Tell the table you are ready to start"
        />
        {isHost ? (
          <PrimaryButton
            label={
              everyoneReady
                ? "Start the game"
                : view.members.length < 2
                  ? "Waiting for players"
                  : `Waiting for ${notReadyCount} player${notReadyCount === 1 ? "" : "s"}`
            }
            onPress={() => void start()}
            disabled={busy || !everyoneReady}
          />
        ) : (
          <Text style={styles.note}>
            {everyoneReady
              ? "Everyone is ready. The host starts the game."
              : "The game starts when everyone is ready."}
          </Text>
        )}
      </View>
      <RoomSettings
        room={view.room}
        seatsTaken={view.members.length}
        token={token}
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => void refreshRoom()}
      />
      <ChatSheet
        roomID={view.room.id}
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chat.messages}
        loading={chat.loading}
        reload={chat.reload}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  card: {
    backgroundColor: colour.panelSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    gap: space.md,
  },
  cardTitle: {
    ...text.label,
    color: colour.creamSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  codeRow: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  codeLabel: { ...text.small, color: colour.creamSoft },
  code: {
    ...text.title,
    color: colour.accent,
    letterSpacing: 6,
    fontVariant: ["tabular-nums"],
  },
  shareRow: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  grow: { flexGrow: 1, flexBasis: 140 },
  note: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
  error: { ...text.small, color: colour.dangerInk },
  actions: { flexDirection: "row", alignItems: "center", gap: space.xs },
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
  seat: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: TOUCH,
  },
  empty: { opacity: 0.45 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colour.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmpty: { backgroundColor: "rgba(255,255,255,0.12)" },
  avatarLetter: { color: colour.accentInk, fontWeight: "800", fontSize: 16 },
  seatWho: { flex: 1 },
  seatName: { ...text.body, color: colour.cream, fontWeight: "700" },
  seatRole: { ...text.small, color: colour.creamSoft },
  seatEmpty: { ...text.body, color: colour.creamSoft, flex: 1 },
  state: { ...text.small, fontWeight: "700" },
  ready: { color: colour.good },
  notReady: { color: colour.creamSoft },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colour.line,
    backgroundColor: colour.feltDeep,
  },
});
