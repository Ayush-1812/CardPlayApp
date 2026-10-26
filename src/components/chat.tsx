// The table talk.
//
// Half of a card game is what people say while they play it, and on a
// phone there is no room for a chat column beside the cards. So it lives
// in a sheet that slides up over the table, keeps a count of what arrived
// while it was shut, and closes the moment a hand needs the screen back.

import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { chatSince, sendChat, type ChatMessage } from "../api";
import type { Frame } from "../realtime";
import { useLive } from "../live";
import { useSession } from "../session";
import { colour, radius, space, TOUCH, type as text } from "../theme";
import { uuid } from "../realtime";

// useChat keeps the log for a room and says how much of it is unread, so
// a table can show a badge without opening anything.
export function useChat(roomID: string | undefined, open: boolean) {
  const { token } = useSession();
  const { listen } = useLive();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const after = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(
    (full: boolean) => {
      if (!token || !roomID) return Promise.resolve();
      // Loads run one at a time, or two cursors interleave and messages
      // arrive twice.
      const next = queue.current.then(async () => {
        const page = await chatSince(token, roomID, full ? 0 : after.current);
        if (page.items.length === 0 && !full) return;
        after.current = page.items[page.items.length - 1]?.id ?? after.current;
        setMessages((current) => {
          const merged = full ? page.items : [...current, ...page.items];
          // The same message can arrive from a push and a read; keep one.
          const seen = new Set<number>();
          return merged
            .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
            .slice(-300);
        });
      });
      queue.current = next.catch(() => undefined);
      return next;
    },
    [token, roomID],
  );

  useEffect(() => {
    if (!roomID) return;
    after.current = 0;
    setMessages([]);
    setLoading(true);
    void load(true).finally(() => setLoading(false));
  }, [roomID, load]);

  // The server says when something changed rather than sending the
  // message itself, so this reads the new tail.
  useEffect(() => {
    return listen((frame: Frame) => {
      if (frame.type !== "chat.updated") return;
      void load(false);
    });
  }, [listen, load]);

  // Anything that arrives while the sheet is shut is unread; opening it
  // clears the count.
  useEffect(() => {
    if (open) setUnread(0);
  }, [open, messages.length]);
  const lastSeen = useRef(0);
  useEffect(() => {
    if (open) {
      lastSeen.current = messages.length;
      return;
    }
    const fresh = messages.length - lastSeen.current;
    if (fresh > 0) setUnread(fresh);
  }, [messages.length, open]);

  return { messages, loading, unread, reload: load };
}

export function ChatSheet({
  roomID,
  visible,
  onClose,
  messages,
  loading,
  reload,
  // Some games close the chat at particular moments -- Trump does it while
  // the trump suit is being chosen -- and the reason is worth saying.
  closed,
}: {
  roomID: string | undefined;
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  reload: (full: boolean) => Promise<unknown>;
  closed?: string;
}) {
  const { token, user } = useSession();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const clientID = useRef(uuid());
  const list = useRef<FlatList<ChatMessage>>(null);

  async function send() {
    const body = draft.trim();
    if (!body || !token || !roomID) return;
    setSending(true);
    setError("");
    try {
      await sendChat(token, roomID, body, clientID.current);
      clientID.current = uuid();
      setDraft("");
      void Haptics.selectionAsync();
      await reload(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Table talk</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close the chat"
            >
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>

          {loading && messages.length === 0 ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colour.accent} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.note}>Nothing said yet.</Text>
            </View>
          ) : (
            <FlatList
              ref={list}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.log}
              onContentSizeChange={() =>
                list.current?.scrollToEnd({ animated: false })
              }
              renderItem={({ item }) => {
                const mine = item.user_id === user?.id;
                return (
                  <View style={[styles.bubble, mine && styles.mine]}>
                    {!mine ? (
                      <Text style={styles.who}>{item.display_name}</Text>
                    ) : null}
                    <Text style={[styles.said, mine && styles.saidMine]}>
                      {item.body}
                    </Text>
                  </View>
                );
              }}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {closed ? (
            <Text style={styles.note}>{closed}</Text>
          ) : (
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Say something"
                placeholderTextColor={colour.creamSoft}
                style={styles.input}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={() => void send()}
                blurOnSubmit
              />
              <Pressable
                onPress={() => void send()}
                disabled={sending || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={({ pressed }) => [
                  styles.send,
                  (sending || !draft.trim()) && styles.sendOff,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.sendMark}>↑</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The button that opens it, with the count of what was missed.
export function ChatButton({
  unread,
  onPress,
}: {
  unread: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Table talk, ${unread} unread` : "Table talk"
      }
      hitSlop={6}
      style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
    >
      <Text style={styles.chatMark}>💬</Text>
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetWrap: { justifyContent: "flex-end" },
  sheet: {
    maxHeight: "78%",
    minHeight: 260,
    backgroundColor: colour.feltDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colour.line,
    paddingBottom: space.lg,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.lg,
  },
  title: { ...text.heading, color: colour.cream, fontSize: 17 },
  close: { ...text.label, color: colour.accent, padding: space.xs },
  empty: { padding: space.xl, alignItems: "center" },
  note: {
    ...text.small,
    color: colour.creamSoft,
    paddingHorizontal: space.lg,
    lineHeight: 17,
  },
  log: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.line,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(239,192,73,0.16)",
    borderColor: colour.accent,
  },
  who: { ...text.small, color: colour.accent, marginBottom: 2 },
  said: { ...text.body, color: colour.cream, lineHeight: 20 },
  saidMine: { color: colour.cream },
  error: { ...text.small, color: colour.dangerInk, paddingHorizontal: space.lg },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  input: {
    flex: 1,
    minHeight: TOUCH,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: colour.panelSolid,
    color: colour.cream,
    fontSize: 16,
  },
  send: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.accent,
  },
  sendOff: { opacity: 0.4 },
  sendMark: { color: colour.accentInk, fontSize: 20, fontWeight: "800" },
  pressed: { opacity: 0.8 },
  chatButton: {
    width: TOUCH - 8,
    height: TOUCH - 8,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.panel,
  },
  chatMark: { fontSize: 18 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colour.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
