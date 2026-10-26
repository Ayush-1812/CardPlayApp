// The live connection.
//
// One socket carries everything: the room, the match, the chat and the
// voice signalling. A phone loses its connection constantly -- a tunnel, a
// lift, a switch from wifi to data, the screen going off -- so this
// reconnects on its own, re-subscribes to whatever it was watching, and
// tells the screen what state it is in so the player is never left
// wondering whether the table has stopped or they have.

import { API_URL, api } from "./api";

// Close codes the server uses to say something final. Reconnecting after
// one of these would loop.
export const CLOSE_SESSION_ENDED = 4001;
export const CLOSE_ROOM_UNAVAILABLE = 4004;
export const CLOSE_REPLACED = 4009;

export type Connection =
  | "connecting"
  | "live"
  | "reconnecting"
  | "replaced"
  | "ended"
  | "gone";

export type Frame = {
  v?: number;
  type: string;
  id?: string;
  room_id?: string;
  match_id?: string;
  payload?: unknown;
};

export type Handlers = {
  onConnection?: (state: Connection) => void;
  onFrame?: (frame: Frame) => void;
};

type Pending = {
  roomID?: string;
  matchID?: string;
};

// A command is sent and then waited for: the table shows the card moving
// only once the server has taken it, which is the difference between a
// move that happened and one that looked like it did.
export type Command = {
  kind: string;
  payload?: unknown;
  expectedRevision: number;
};

const MAX_BACKOFF = 15_000;

export class Live {
  private socket: WebSocket | null = null;
  private handlers: Handlers;
  private token: string;
  private want: Pending = {};
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private replies = new Map<string, (frame: Frame) => void>();

  constructor(token: string, handlers: Handlers) {
    this.token = token;
    this.handlers = handlers;
  }

  // watch says what this socket should be subscribed to. Calling it again
  // moves the subscription, which is how a room carries on to the next
  // game without being rebuilt.
  watch(next: Pending) {
    const changed =
      next.roomID !== this.want.roomID || next.matchID !== this.want.matchID;
    this.want = { ...next };
    if (!changed) return;
    if (this.socket?.readyState === WebSocket.OPEN) this.subscribe();
  }

  open() {
    this.closed = false;
    this.connect();
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.timer = null;
    this.heartbeat = null;
    for (const resolve of this.replies.values())
      resolve({ type: "error", payload: { code: "OFFLINE" } });
    this.replies.clear();
    this.socket?.close();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // send fires a frame and resolves with the server's reply to it, or with
  // an offline error if the connection goes before one arrives.
  send(frame: Omit<Frame, "v">, waitForReply = false): Promise<Frame> {
    const id = frame.id ?? uuid();
    const body = JSON.stringify({ v: 1, ...frame, id });
    if (this.socket?.readyState !== WebSocket.OPEN)
      return Promise.resolve({
        type: "error",
        payload: {
          code: "OFFLINE",
          message: "You are not connected to the table.",
        },
      });
    this.socket.send(body);
    if (!waitForReply) return Promise.resolve({ type: "ack", id });
    return new Promise((resolve) => {
      this.replies.set(id, resolve);
      // A command the server never answers must not leave the table stuck
      // waiting for it.
      setTimeout(() => {
        if (this.replies.delete(id))
          resolve({
            type: "error",
            payload: { code: "TIMEOUT", message: "The table did not answer." },
          });
      }, 10_000);
    });
  }

  command(matchID: string, command: Command): Promise<Frame> {
    return this.send(
      {
        type: "game.command",
        match_id: matchID,
        payload: {
          command_id: uuid(),
          expected_revision: command.expectedRevision,
          kind: command.kind,
          payload: command.payload ?? {},
        },
      },
      true,
    );
  }

  resync() {
    if (this.want.matchID) void this.send({ type: "match.resync" });
  }

  private state(next: Connection) {
    this.handlers.onConnection?.(next);
  }

  private async connect() {
    if (this.closed) return;
    this.state(this.attempt === 0 ? "connecting" : "reconnecting");
    let ticket: string;
    try {
      // The handshake carries no headers worth trusting, so the session is
      // spent on a one-shot ticket over the authenticated HTTP path.
      const got = await api<{ ticket: string }>("/realtime/ticket", {
        method: "POST",
        token: this.token,
      });
      ticket = got.ticket;
    } catch {
      this.retry();
      return;
    }
    if (this.closed) return;

    const url = `${API_URL.replace(/^http/, "ws")}/ws?ticket=${encodeURIComponent(ticket)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      if (this.closed) {
        socket.close();
        return;
      }
      this.attempt = 0;
      this.state("live");
      this.subscribe();
      // A phone's radio sleeps between packets; a ping every twenty
      // seconds keeps the connection from being collected by a carrier
      // that sees it as idle.
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ v: 1, type: "ping", id: uuid() }));
      }, 20_000);
    };

    socket.onmessage = (event) => {
      let frame: Frame;
      try {
        frame = JSON.parse(String(event.data)) as Frame;
      } catch {
        return;
      }
      if (frame.id) {
        const waiting = this.replies.get(frame.id);
        if (waiting && frame.type !== "pong") {
          this.replies.delete(frame.id);
          waiting(frame);
        }
      }
      if (frame.type === "pong") return;
      this.handlers.onFrame?.(frame);
    };

    socket.onerror = () => socket.close();

    socket.onclose = (event) => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      for (const resolve of this.replies.values())
        resolve({ type: "error", payload: { code: "OFFLINE" } });
      this.replies.clear();
      if (this.closed || this.socket !== socket) return;
      const code = (event as { code?: number }).code;
      if (code === CLOSE_REPLACED) {
        this.state("replaced");
        return;
      }
      if (code === CLOSE_SESSION_ENDED) {
        this.state("ended");
        return;
      }
      if (code === CLOSE_ROOM_UNAVAILABLE) {
        this.state("gone");
        return;
      }
      this.retry();
    };
  }

  private subscribe() {
    if (this.want.roomID)
      void this.send({ type: "room.subscribe", room_id: this.want.roomID });
    if (this.want.matchID)
      void this.send({ type: "match.subscribe", match_id: this.want.matchID });
  }

  private retry() {
    if (this.closed) return;
    this.state("reconnecting");
    const wait =
      Math.min(MAX_BACKOFF, 800 * 2 ** this.attempt++) + Math.random() * 300;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.connect(), wait);
  }
}

// What the player is told about the connection. Short, and never blaming
// them for a network they cannot do anything about.
export const CONNECTION_WORDS: Record<Connection, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  replaced: "This table is open somewhere else",
  ended: "Your session has ended",
  gone: "This room has closed",
};

// React Native has no crypto.randomUUID on every engine, and the server
// only needs these to be unique per socket.
export function uuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}
