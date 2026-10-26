// One socket for the whole app.
//
// The point of putting it here rather than inside a screen is that a group
// can go from the room to a game of Trump, back to the room, and on to
// Bluff without the connection being torn down and rebuilt -- and, once
// voice is running on the same socket, without anybody dropping out of the
// call between games.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { roomView as fetchRoom, type RoomView } from "./api";
import {
  Live,
  type Command,
  type Connection,
  type Frame,
} from "./realtime";
import { useSession } from "./session";

// What the server sends for a match in progress. The shape of `state`
// belongs to whichever game is being played, so each table reads its own.
export type MatchState = {
  match_id: string;
  room_id: string;
  game_id: string;
  status: string;
  version: number;
  revision: number;
  // When this arrived here, so a countdown can run against our own clock
  // rather than trusting the phone's idea of the time.
  received_at: number;
  seats?: { user_id: string; seat: number; display_name?: string }[];
  view?: unknown;
  deadline?: string | null;
  winner_id?: string | null;
};

type LiveValue = {
  connection: Connection;
  room: RoomView | null;
  match: MatchState | null;
  // Ask the socket to follow a room, a match, or both.
  watch: (next: { roomID?: string; matchID?: string }) => void;
  command: (command: Command) => Promise<Frame>;
  // Voice and chat frames are passed through to whoever is listening, so
  // this provider does not have to know about either.
  listen: (listener: (frame: Frame) => void) => () => void;
  refreshRoom: () => Promise<void>;
};

const LiveContext = createContext<LiveValue | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { token } = useSession();
  const [connection, setConnection] = useState<Connection>("connecting");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const live = useRef<Live | null>(null);
  const want = useRef<{ roomID?: string; matchID?: string }>({});
  const listeners = useRef(new Set<(frame: Frame) => void>());

  const refreshRoom = useCallback(async () => {
    const id = want.current.roomID;
    if (!token || !id) return;
    try {
      setRoom(await fetchRoom(token, id));
    } catch {
      // The socket will say if the room is really gone; a failed read on
      // its own is not worth putting on screen.
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      live.current?.close();
      live.current = null;
      return;
    }
    const socket = new Live(token, {
      onConnection: setConnection,
      onFrame: (frame) => {
        if (frame.type === "room.snapshot" && frame.payload)
          setRoom(frame.payload as RoomView);
        else if (frame.type === "room.updated") void refreshRoom();
        else if (frame.type === "match.state" && frame.payload) {
          const next = {
            ...(frame.payload as MatchState),
            received_at: Date.now(),
          };
          // Pushes can overtake each other on a slow connection; the
          // newest version of a match is the only one worth drawing.
          setMatch((current) =>
            !current ||
            current.match_id !== next.match_id ||
            next.version >= current.version
              ? next
              : current,
          );
        }
        for (const listener of listeners.current) listener(frame);
      },
    });
    live.current = socket;
    socket.watch(want.current);
    socket.open();
    return () => {
      socket.close();
      live.current = null;
    };
  }, [token, refreshRoom]);

  // Coming back from the home screen is the most common way a phone finds
  // itself behind: ask for the current state rather than waiting for the
  // next push.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const socket = live.current;
      if (!socket) return;
      if (socket.connected) {
        socket.resync();
        void refreshRoom();
      } else {
        socket.open();
      }
    });
    return () => subscription.remove();
  }, [refreshRoom]);

  const watch = useCallback((next: { roomID?: string; matchID?: string }) => {
    const changed =
      next.roomID !== want.current.roomID ||
      next.matchID !== want.current.matchID;
    want.current = next;
    if (!changed) return;
    // Leaving a match behind means the state on screen belongs to nothing.
    if (!next.matchID) setMatch(null);
    live.current?.watch(next);
  }, []);

  const command = useCallback(async (command: Command) => {
    const id = want.current.matchID;
    const socket = live.current;
    if (!id || !socket)
      return {
        type: "error",
        payload: { code: "OFFLINE", message: "Not at a table." },
      } as Frame;
    return socket.command(id, command);
  }, []);

  const listen = useCallback((listener: (frame: Frame) => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo<LiveValue>(
    () => ({ connection, room, match, watch, command, listen, refreshRoom }),
    [connection, room, match, watch, command, listen, refreshRoom],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive outside LiveProvider");
  return value;
}

// The error a command came back with, in words worth showing. Server
// messages are written for players, so they are used as they are.
export function commandError(frame: Frame): string | null {
  if (frame.type !== "error") return null;
  const payload = frame.payload as { code?: string; message?: string } | undefined;
  if (payload?.code === "OFFLINE" || payload?.code === "TIMEOUT")
    return payload.message ?? "The table did not answer. Try again.";
  return payload?.message ?? "That move was not allowed.";
}
