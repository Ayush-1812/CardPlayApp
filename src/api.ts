// Talking to the CardPlay server.
//
// The website signs in with a cookie. A phone app cannot rely on a cookie
// jar surviving a reinstall, a backgrounded app or a switch between
// devices, so this client asks the server for a session token instead and
// sends it as a bearer token. The header below is what tells the server it
// is talking to an app rather than a browser.

export const CLIENT_HEADER = "X-CardPlay-Client";
export const CLIENT_NAME = "native";

// Where the server lives. Overridden for development with
// EXPO_PUBLIC_API_URL in a .env file, so the app can be pointed at a
// machine on the same wifi.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://cardplay.onrender.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The server sleeps when nobody has played for a while, and takes a few
// seconds to wake. A request that fails while it is waking is worth
// retrying rather than reporting as broken.
const WAKE_MS = 45_000;
const RETRY_STATUS = new Set([502, 503, 504]);

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  // signal lets a screen give up when it is closed.
  signal?: AbortSignal;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;
  const started = Date.now();
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const response = await fetch(`${API_URL}/api/v1${path}`, {
        method,
        signal,
        headers: {
          "Content-Type": "application/json",
          [CLIENT_HEADER]: CLIENT_NAME,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      let payload: unknown = undefined;
      try {
        payload = text ? JSON.parse(text) : undefined;
      } catch {
        // A gateway or a proxy answering with HTML means the server is not
        // there yet, whatever the status line says.
        if (retryable(response.status, started, attempt)) {
          await pause(attempt);
          continue;
        }
        throw new ApiError(
          response.status,
          "UNAVAILABLE",
          "CardPlay is starting up. Give it a few seconds and try again.",
        );
      }
      if (!response.ok) {
        const error = (payload as { error?: { code?: string; message?: string } })
          ?.error;
        if (retryable(response.status, started, attempt)) {
          await pause(attempt);
          continue;
        }
        throw new ApiError(
          response.status,
          error?.code ?? "ERROR",
          error?.message ?? "Something went wrong. Please try again.",
        );
      }
      return payload as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if ((e as { name?: string })?.name === "AbortError") throw e;
      // A network error while the server wakes looks the same as being
      // offline; only the clock can tell them apart.
      if (Date.now() - started < WAKE_MS) {
        await pause(attempt);
        continue;
      }
      throw new ApiError(
        0,
        "OFFLINE",
        "Cannot reach CardPlay. Check your connection and try again.",
      );
    }
  }
}

function retryable(status: number, started: number, attempt: number): boolean {
  return (
    RETRY_STATUS.has(status) && Date.now() - started < WAKE_MS && attempt < 12
  );
}

function pause(attempt: number): Promise<void> {
  const wait = Math.min(2000, 250 * attempt);
  return new Promise((resolve) => setTimeout(resolve, wait));
}

// ---- what the server sends back -----------------------------------

export type User = {
  id: string;
  handle: string;
  display_name: string;
  email?: string;
  guest: boolean;
  email_verified: boolean;
};

export type Session = { token: string; user: User };

export type Member = {
  id: string;
  handle: string;
  display_name: string;
  seat: number;
  ready: boolean;
};

export type Room = {
  id: string;
  host_id: string;
  name: string;
  game_id: string;
  capacity: number;
  deck_count: number;
  status: string;
};

export type RoomView = {
  room: Room;
  members: Member[];
  match?: { id: string; status: string; winner_id?: string | null };
};

// ---- the calls the app makes ---------------------------------------

export function playAsGuest(displayName: string): Promise<Session> {
  return api<Session>("/auth/guest", {
    method: "POST",
    body: { display_name: displayName },
  });
}

export function me(token: string): Promise<{ user: User }> {
  return api<{ user: User }>("/me", { token });
}

export function listRooms(token: string): Promise<{ items: RoomView[] }> {
  return api<{ items: RoomView[] }>("/rooms", { token });
}

export function createRoom(
  token: string,
  room: { name: string; capacity: number; game: string },
): Promise<Room> {
  return api<Room>("/rooms", { method: "POST", body: room, token });
}

export function roomView(token: string, id: string): Promise<RoomView> {
  return api<RoomView>(`/rooms/${id}`, { token });
}

export function setReady(
  token: string,
  id: string,
  ready: boolean,
): Promise<void> {
  return api<void>(`/rooms/${id}/ready`, {
    method: "PUT",
    body: { ready },
    token,
  });
}

export function createInvitation(
  token: string,
  id: string,
): Promise<{ token: string }> {
  return api<{ token: string }>(`/rooms/${id}/invitations`, {
    method: "POST",
    body: {},
    token,
  });
}

export function joinWithToken(
  token: string,
  invite: string,
): Promise<{ room_id: string }> {
  return api<{ room_id: string }>("/rooms/join", {
    method: "POST",
    body: { token: invite },
    token,
  });
}

export type ChatMessage = {
  id: number;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
  client_id: string;
};

// The chat is read as a tail: everything after the last id already shown.
export function chatSince(
  token: string,
  roomID: string,
  after: number,
): Promise<{ items: ChatMessage[] }> {
  const query = after > 0 ? `?after=${after}` : "";
  return api<{ items: ChatMessage[] }>(`/rooms/${roomID}/chat${query}`, {
    token,
  });
}

// client_id lets the server recognise a message that was sent twice
// because a phone lost its answer, not because somebody said it twice.
export function sendChat(
  token: string,
  roomID: string,
  body: string,
  clientID: string,
): Promise<void> {
  return api<void>(`/rooms/${roomID}/chat`, {
    method: "POST",
    body: { body, client_id: clientID },
    token,
  });
}

export function startMatch(
  token: string,
  roomID: string,
): Promise<{ match_id: string }> {
  return api<{ match_id: string }>(`/rooms/${roomID}/matches`, {
    method: "POST",
    token,
  });
}
