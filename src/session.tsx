// Who is signed in, kept across app restarts.
//
// A guest who closes the app and comes back should still be the same
// player at the same table, so the token is stored on the device and
// checked against the server when the app opens.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, me, playAsGuest, type User } from "./api";

const TOKEN_KEY = "cardplay.session";

type SessionState = {
  // ready is false until the stored token has been checked, so a screen
  // does not flash a sign-in form at someone who is already signed in.
  ready: boolean;
  token: string | null;
  user: User | null;
  busy: boolean;
  error: string;
  signInAsGuest: (name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const Context = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // On open: take the stored token, and only trust it if the server still
  // does. A guest account that was cleaned up should not leave the app
  // pretending to be signed in.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (!stored) return;
        const { user: known } = await me(stored);
        if (!alive) return;
        setToken(stored);
        setUser(known);
      } catch (e) {
        // An expired session is not an error worth showing on open.
        if (e instanceof ApiError && e.status === 401)
          await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signInAsGuest = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name so the table knows who you are.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const session = await playAsGuest(trimmed);
      await AsyncStorage.setItem(TOKEN_KEY, session.token);
      setToken(session.token);
      setUser(session.user);
      return true;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not reach CardPlay. Try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ ready, token, user, busy, error, signInAsGuest, signOut }),
    [ready, token, user, busy, error, signInAsGuest, signOut],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(Context);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
