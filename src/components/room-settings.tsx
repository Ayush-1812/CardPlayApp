// What the host can change before a game starts.
//
// Three things, because three is all that matters before the cards come
// out: what the room is called, how many seats it has, and -- for the
// games where it means anything -- how many decks are being played with.
// Everything is within what the server will accept, so the only way to
// get an error here is to lose the connection.

import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { updateRoom, type Room } from "../api";
import { GAMES, gameByID, type GameInfo } from "../games";
import { colour, radius, space, TOUCH, type as text } from "../theme";
import { Button, PrimaryButton } from "./button";

// A deck count nobody would sensibly exceed, and the same ceiling the
// server enforces.
const MAX_DECKS = 4;

export function RoomSettings({
  room,
  seatsTaken,
  token,
  visible,
  onClose,
  onSaved,
}: {
  room: Room;
  seatsTaken: number;
  token: string | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [gameID, setGameID] = useState(room.game_id);
  const [capacity, setCapacity] = useState(room.capacity);
  const [decks, setDecks] = useState(room.deck_count || 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const game = gameByID(gameID);

  // A seat cannot be taken away from somebody already sitting in it, and
  // the game's own limits bound the rest.
  const floor = Math.max(game?.min ?? 2, seatsTaken);
  const ceiling = game?.max ?? 6;

  // Changing the game moves the seat count into whatever the new game
  // accepts, so the host never has to work out that Trump is four.
  function chooseGame(next: GameInfo) {
    setGameID(next.id);
    setCapacity((was) =>
      Math.min(next.max, Math.max(next.min, Math.max(was, seatsTaken))),
    );
  }

  async function save() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await updateRoom(token, room.id, {
        name: name.trim() || room.name,
        capacity,
        decks: game?.decks ? decks : undefined,
        game: gameID === room.game_id ? undefined : gameID,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.wrap}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Room settings</Text>

          {/* Changing the game keeps the room: the same people, the same
              seats, the same call. */}
          <View style={styles.field}>
            <Text style={styles.label}>Game</Text>
            <View style={styles.games}>
              {GAMES.filter((g) => g.table === "app").map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => chooseGame(g)}
                  accessibilityRole="button"
                  accessibilityLabel={"Play " + g.name}
                  accessibilityState={{ selected: g.id === gameID }}
                  style={({ pressed }) => [
                    styles.game,
                    g.id === gameID && styles.gameOn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.gameSuit}>{g.suit}</Text>
                  <Text style={styles.gameName}>{g.name}</Text>
                </Pressable>
              ))}
            </View>
            {gameID === room.game_id ? (
              <Text style={styles.note}>
                Nobody has to leave. Changing the game keeps the room, the
                seats and the call.
              </Text>
            ) : (
              <Text style={styles.note}>
                Everyone goes back to not ready, so the table agrees before
                it starts.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={room.name}
              placeholderTextColor={colour.creamSoft}
              style={styles.input}
              maxLength={80}
            />
          </View>

          <Stepper
            label="Seats"
            value={capacity}
            min={floor}
            max={ceiling}
            onChange={setCapacity}
            note={
              game && game.min === game.max
                ? `${game.name} is always ${game.max} players.`
                : seatsTaken > (game?.min ?? 0)
                  ? `${seatsTaken} already sitting down.`
                  : `${game?.name ?? "This game"} takes ${game?.min}–${game?.max}.`
            }
          />

          {game?.decks ? (
            <Stepper
              label="Decks"
              value={decks}
              min={1}
              max={MAX_DECKS}
              onChange={setDecks}
              note={
                decks === 1
                  ? "One deck. A longer game with more players."
                  : `${decks} decks: ${decks * 52} cards, and up to ${decks * 4} of a rank to lie about.`
              }
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Button label="Cancel" onPress={onClose} full={false} style={styles.grow} />
            <PrimaryButton
              label={busy ? "Saving…" : "Save"}
              onPress={() => void save()}
              disabled={busy}
              full={false}
              style={styles.grow}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// A stepper rather than a text field: two big targets beat a number pad.
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  note?: string;
}) {
  const locked = min >= max;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={locked || value <= min}
          accessibilityRole="button"
          accessibilityLabel={`One fewer ${label.toLowerCase()}`}
          style={({ pressed }) => [
            styles.step,
            (locked || value <= min) && styles.stepOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stepMark}>−</Text>
        </Pressable>
        <Text style={styles.value} accessibilityLabel={`${value} ${label.toLowerCase()}`}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={locked || value >= max}
          accessibilityRole="button"
          accessibilityLabel={`One more ${label.toLowerCase()}`}
          style={({ pressed }) => [
            styles.step,
            (locked || value >= max) && styles.stepOff,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.stepMark}>+</Text>
        </Pressable>
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  wrap: { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colour.feltDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colour.line,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  title: { ...text.heading, color: colour.cream, fontSize: 17 },
  field: { gap: space.sm },
  label: {
    ...text.label,
    color: colour.creamSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
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
  games: { flexDirection: "row", gap: space.sm },
  game: {
    flex: 1,
    minHeight: TOUCH + 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colour.line,
    backgroundColor: colour.panelSolid,
  },
  gameOn: {
    borderColor: colour.accent,
    backgroundColor: "rgba(239,192,73,0.16)",
  },
  gameSuit: { fontSize: 17, color: colour.cream },
  gameName: { ...text.small, color: colour.cream, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.lg },
  step: {
    width: TOUCH,
    height: TOUCH,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colour.panelSolid,
    borderWidth: 1,
    borderColor: colour.line,
  },
  stepOff: { opacity: 0.35 },
  stepMark: { color: colour.cream, fontSize: 22, lineHeight: 24 },
  value: {
    ...text.title,
    color: colour.accent,
    minWidth: 40,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  pressed: { opacity: 0.8 },
  note: { ...text.small, color: colour.creamSoft, lineHeight: 17 },
  error: { ...text.small, color: colour.dangerInk },
  row: { flexDirection: "row", gap: space.sm },
  grow: { flexGrow: 1, flexBasis: 100 },
});
