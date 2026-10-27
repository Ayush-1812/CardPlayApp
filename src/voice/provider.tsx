// Voice is held above every screen, like the socket it signals over.
//
// This is what makes "play another game without leaving the call" true:
// the lobby and the table are different screens, but the microphone, the
// peer connections and the channel membership belong to the room, so
// walking between them changes nothing. Only leaving the room ends a call.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLive } from "../live";
import { useSession } from "../session";
import { useVoice } from "./use-voice";

type VoiceValue = ReturnType<typeof useVoice>;

const VoiceContext = createContext<VoiceValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { token, user } = useSession();
  const { room, connection, listen, sendFrame } = useLive();
  const voice = useVoice({
    roomID: room?.room.id ?? null,
    selfID: user?.id,
    token,
    connection,
    send: sendFrame,
    listen,
  });
  const value = useMemo(() => voice, [voice]);
  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}

export function useVoiceChannel(): VoiceValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoiceChannel outside VoiceProvider");
  return value;
}
