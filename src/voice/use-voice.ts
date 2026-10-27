// Voice at the table, from the phone's side.
//
// One peer connection per other player -- a mesh. A CardPlay room seats at
// most six, so nobody is sending more than five streams. The server relays
// the negotiation only: it can refuse to let a connection form while a game
// closes voice, but it never carries the audio.
//
// Three things make a mesh of four or five people hold up, and all three
// were learned the hard way on the website, where a naive version left one
// pair silent while the rest worked:
//
//  1. A peer connection is created synchronously. Anything awaited between
//     "is there a connection to this player?" and "here is one" lets two
//     callers each build one, and the loser's answers then arrive at an
//     object nobody holds.
//  2. Negotiation follows the perfect-negotiation pattern, so two offers
//     that cross in flight resolve instead of deadlocking. The higher user
//     id is polite and gives way.
//  3. A watchdog reconciles the mesh every two seconds and counts arriving
//     packets, because "connected" is not the same as audible -- a silent
//     link is exactly what a player means by "I cannot hear them".
//
// The microphone is opened only when the player asks for it, and released
// when they leave the table, when the app is closed, and when the game
// closes voice.

import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import { api } from "../api";
import type { Frame } from "../realtime";

export type VoiceParticipant = {
  user_id: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
};

export type VoicePolicy = { open: boolean; reason?: string };

export type IceConfig = {
  enabled: boolean;
  ice_servers: { urls: string | string[]; username?: string; credential?: string }[];
  ttl_seconds: number;
  relay_available: boolean;
  max_participants: number;
};

export type SignalKind = "offer" | "answer" | "candidate" | "bye";

export type VoiceStatus =
  | "off"
  | "asking"
  | "joining"
  | "live"
  | "error"
  | "unavailable";

// How long a connection may go without reaching "connected" before it is
// torn down and tried again: long enough for ICE on a slow mobile network,
// short enough that nobody sits in silence wondering.
const STALL_MS = 9000;
// How long a connected link may carry nothing before it is rebuilt.
const SILENT_MS = 8000;
const WATCHDOG_MS = 2000;

type Peer = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  // polite yields when two offers cross.
  polite: boolean;
  makingOffer: boolean;
  pending: object[];
  since: number;
  packets: number;
  heard: number;
};

type Options = {
  roomID: string | null | undefined;
  selfID: string | undefined;
  // The session, for the one authenticated call this makes: the ICE
  // servers and a TURN credential that expires.
  token: string | null;
  // "live" when the socket is up; anything else means signalling cannot
  // get through.
  connection: string;
  send: ((frame: Omit<Frame, "v">, wait?: boolean) => Promise<Frame>) | null;
  listen: (fn: (frame: Frame) => void) => () => void;
};

export function useVoice({
  roomID,
  selfID,
  token,
  connection,
  send,
  listen,
}: Options) {
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [policy, setPolicy] = useState<VoicePolicy>({ open: true });
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});

  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const iceRef = useRef<{ config: IceConfig; expires: number } | null>(null);
  const icePending = useRef<Promise<IceConfig> | null>(null);
  const joinedRef = useRef(false);
  const liveRef = useRef(false);
  const sendRef = useRef(send);
  const roomRef = useRef(roomID);
  const selfRef = useRef(selfID);
  const tokenRef = useRef(token);
  const policyRef = useRef(policy);
  const participantsRef = useRef(participants);
  const publishedRef = useRef({ muted: false, deafened: false, speaking: false });
  const transmitRef = useRef({ muted: false, deafened: false });
  const connectRef = useRef<(id: string) => void>(() => {});

  // These callbacks outlive any one render, so what they need is kept in
  // refs and synced after every render rather than captured.
  useEffect(() => {
    sendRef.current = send;
    roomRef.current = roomID;
    selfRef.current = selfID;
    tokenRef.current = token;
    policyRef.current = policy;
    participantsRef.current = participants;
    transmitRef.current = { muted, deafened };
  });

  // ---- transmission -------------------------------------------------
  // One rule decides whether the microphone is live, so the game's policy,
  // mute and deafen can never disagree with each other.
  const applyTransmit = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const t = transmitRef.current;
    const allowed = policyRef.current.open && !t.muted && !t.deafened;
    for (const track of stream.getAudioTracks()) track.enabled = allowed;
  }, []);

  useEffect(applyTransmit, [muted, deafened, policy, applyTransmit]);

  // Deafening silences everyone else. There are no audio elements on a
  // phone, so the remote tracks themselves are switched off.
  useEffect(() => {
    for (const peer of peersRef.current.values())
      for (const track of peer.stream?.getAudioTracks() ?? [])
        track.enabled = !deafened;
  }, [deafened]);

  // ---- publishing our own state -------------------------------------
  const publish = useCallback(
    (next: { muted: boolean; deafened: boolean; speaking: boolean }) => {
      const prev = publishedRef.current;
      if (
        prev.muted === next.muted &&
        prev.deafened === next.deafened &&
        prev.speaking === next.speaking
      )
        return;
      publishedRef.current = next;
      const room = roomRef.current;
      if (!room || !joinedRef.current) return;
      void sendRef.current?.({
        type: "voice.state",
        room_id: room,
        payload: next,
      });
    },
    [],
  );

  useEffect(() => {
    if (!liveRef.current) return;
    publish({ muted, deafened, speaking });
  }, [muted, deafened, speaking, publish]);

  // ---- signalling ----------------------------------------------------
  const signal = useCallback(
    async (to: string, kind: SignalKind, data: unknown) => {
      const room = roomRef.current;
      if (!room) return;
      const reply = await sendRef.current?.(
        { type: "voice.signal", room_id: room, payload: { to, kind, data } },
        true,
      );
      // A refusal is not fatal to the game: the policy may have closed
      // voice between this frame leaving and arriving.
      const payload = reply?.payload as { code?: string; message?: string };
      if (reply?.type === "error" && payload?.code === "VOICE_CLOSED")
        setPolicy({ open: false, reason: payload.message });
    },
    [],
  );

  const dropPeer = useCallback((id: string) => {
    const peer = peersRef.current.get(id);
    if (!peer) return;
    peersRef.current.delete(id);
    try {
      peer.pc.close();
    } catch {
      // Already gone.
    }
    setLinks((held) => {
      const next = { ...held };
      delete next[id];
      return next;
    });
  }, []);

  // One ICE request is shared: several peers coming up together must not
  // each ask for their own TURN credential.
  const ice = useCallback(async (): Promise<IceConfig> => {
    const held = iceRef.current;
    if (held && held.expires > Date.now()) return held.config;
    if (!icePending.current) {
      icePending.current = api<IceConfig>("/voice/ice", {
        token: tokenRef.current,
      })
        .then((config) => {
          iceRef.current = {
            config,
            // Renewed early, so a connection never starts with a credential
            // about to expire.
            expires:
              Date.now() + Math.max(30, (config.ttl_seconds ?? 300) - 60) * 1000,
          };
          return config;
        })
        .finally(() => {
          icePending.current = null;
        });
    }
    return icePending.current;
  }, []);

  // peerFor returns the connection to another player, creating it if there
  // is none. Deliberately synchronous: see the note at the top.
  const peerFor = useCallback(
    (id: string): Peer | null => {
      const held = peersRef.current.get(id);
      if (held) return held;
      const config = iceRef.current?.config;
      if (!config) {
        // No servers yet. Fetch them; the watchdog builds this connection
        // on its next pass.
        void ice();
        return null;
      }
      const pc = new RTCPeerConnection({ iceServers: config.ice_servers });
      const peer: Peer = {
        pc,
        stream: null,
        // The higher user id is polite, so both sides agree who gives way
        // without having to ask.
        polite: (selfRef.current ?? "") > id,
        makingOffer: false,
        pending: [],
        since: Date.now(),
        packets: 0,
        heard: Date.now(),
      };
      peersRef.current.set(id, peer);

      const local = streamRef.current;
      if (local)
        for (const track of local.getAudioTracks()) pc.addTrack(track, local);

      pc.addEventListener("icecandidate", (event) => {
        if (event?.candidate) void signal(id, "candidate", event.candidate);
      });
      pc.addEventListener("track", (event) => {
        const stream = event?.streams?.[0];
        if (stream) {
          peer.stream = stream;
          // Remote audio plays by itself; deafening is the one thing that
          // has to be applied to it.
          for (const track of stream.getAudioTracks())
            track.enabled = !transmitRef.current.deafened;
        }
      });
      pc.addEventListener("negotiationneeded", () => {
        void (async () => {
          try {
            peer.makingOffer = true;
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);
            await signal(id, "offer", pc.localDescription);
          } catch {
            // The watchdog rebuilds anything that does not come up.
          } finally {
            peer.makingOffer = false;
          }
        })();
      });
      pc.addEventListener("connectionstatechange", () => {
        const state = String(pc.connectionState);
        setLinks((before) => ({ ...before, [id]: state }));
        if (state === "connected") peer.since = Date.now();
      });
      return peer;
    },
    [ice, signal],
  );

  const connectTo = useCallback(
    (id: string) => {
      if (!policyRef.current.open || id === selfRef.current) return;
      peerFor(id);
    },
    [peerFor],
  );
  useEffect(() => {
    connectRef.current = connectTo;
  }, [connectTo]);

  // One negotiation frame. Two offers that cross are resolved rather than
  // deadlocked: the impolite side ignores the other's offer, the polite
  // side rolls back and answers it.
  const onSignal = useCallback(
    async (from: string, kind: SignalKind, data: unknown) => {
      if (kind === "bye") {
        dropPeer(from);
        return;
      }
      let peer = peersRef.current.get(from);
      if (!peer) {
        // An offer can arrive before the servers have been fetched.
        if (!iceRef.current?.config) await ice();
        peer = peerFor(from) ?? undefined;
      }
      if (!peer) return;
      const pc = peer.pc;
      try {
        if (kind === "offer" || kind === "answer") {
          const description = data as { type: "offer" | "answer"; sdp: string };
          const collision =
            description.type === "offer" &&
            (peer.makingOffer || String(pc.signalingState) !== "stable");
          if (!peer.polite && collision) return;
          if (peer.polite && collision)
            // Rolling back lets the crossed offer be answered instead of
            // both sides waiting for the other.
            await pc.setLocalDescription({ type: "rollback" } as never).catch(
              () => undefined,
            );
          await pc.setRemoteDescription(new RTCSessionDescription(description));
          for (const candidate of peer.pending.splice(0))
            await pc
              .addIceCandidate(new RTCIceCandidate(candidate as never))
              .catch(() => undefined);
          if (description.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await signal(from, "answer", pc.localDescription);
          }
          return;
        }
        // Candidates that arrive before the description they belong to are
        // held rather than thrown away.
        if (!pc.remoteDescription) {
          peer.pending.push(data as object);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(data as never));
      } catch {
        // Nothing here is worth interrupting a game for: the watchdog
        // rebuilds a connection that does not come up.
      }
    },
    [dropPeer, ice, peerFor, signal],
  );

  // ---- joining and leaving -------------------------------------------
  const teardown = useCallback(
    (reason: VoiceStatus) => {
      liveRef.current = false;
      joinedRef.current = false;
      for (const id of [...peersRef.current.keys()]) dropPeer(id);
      // Stopping the tracks is what turns the recording indicator off;
      // closing the connections alone would not.
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      (streamRef.current as { release?: () => void } | null)?.release?.();
      streamRef.current = null;
      publishedRef.current = { muted: false, deafened: false, speaking: false };
      setParticipants([]);
      setLinks({});
      setSpeaking(false);
      setStatus(reason);
    },
    [dropPeer],
  );

  const leave = useCallback(() => {
    const room = roomRef.current;
    if (room && joinedRef.current) {
      for (const id of peersRef.current.keys()) void signal(id, "bye", {});
      void sendRef.current?.({ type: "voice.leave", room_id: room });
    }
    teardown("off");
  }, [signal, teardown]);

  const join = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !sendRef.current || joinedRef.current) return;
    setError("");
    setStatus("asking");
    let stream: MediaStream;
    try {
      // Fetched before any connection is built, so peers can then be
      // created without awaiting anything.
      const config = await ice();
      if (!config.enabled) {
        setStatus("unavailable");
        setError("Voice is switched off on this server.");
        return;
      }
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Talk to the table",
            message:
              "CardPlay needs your microphone so the other players can hear you.",
            buttonPositive: "Allow",
            buttonNegative: "Not now",
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setStatus("error");
          setError(
            granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
              ? "The microphone is blocked for CardPlay. Turn it on in Settings to talk."
              : "Without the microphone you can still hear everyone, but nobody can hear you.",
          );
          return;
        }
      }
      // The native WebRTC stack applies echo cancellation, noise
      // suppression and gain control to a microphone track by default,
      // which is what a room full of phones needs and what the browser has
      // to be asked for explicitly.
      stream = (await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })) as MediaStream;
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error && e.message
          ? `The microphone could not be opened: ${e.message}`
          : "The microphone could not be opened.",
      );
      return;
    }
    streamRef.current = stream;
    setStatus("joining");
    const reply = await sendRef.current(
      { type: "voice.join", room_id: room },
      true,
    );
    if (reply.type !== "voice.joined") {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
      const payload = reply.payload as { code?: string; message?: string };
      setStatus(payload?.code === "VOICE_DISABLED" ? "unavailable" : "error");
      setError(payload?.message ?? "Voice is unavailable right now.");
      return;
    }
    joinedRef.current = true;
    liveRef.current = true;
    applyTransmit();
    setStatus("live");
  }, [ice, applyTransmit]);

  // ---- frames from the server ----------------------------------------
  useEffect(() => {
    return listen((frame) => {
      const payload = frame.payload as
        | {
            participants?: VoiceParticipant[];
            policy?: VoicePolicy;
            from?: string;
            kind?: SignalKind;
            data?: unknown;
            open?: boolean;
            reason?: string;
          }
        | undefined;
      if (!payload) return;
      if (frame.type === "voice.joined") {
        if (payload.policy) setPolicy(payload.policy);
        if (payload.participants) setParticipants(payload.participants);
        return;
      }
      if (frame.type === "voice.participants" && payload.participants) {
        setParticipants(payload.participants);
        return;
      }
      if (frame.type === "voice.policy") {
        setPolicy({ open: payload.open ?? true, reason: payload.reason });
        return;
      }
      if (frame.type === "voice.signal" && payload.from && payload.kind)
        void onSignal(payload.from, payload.kind, payload.data).catch(
          () => undefined,
        );
    });
  }, [listen, onSignal]);

  // Connect to everyone the server says is here, and drop anyone who has
  // left. Both sides of a pair build their connection rather than one
  // waiting to be called: a crossed pair of offers is resolved, a missing
  // one is not.
  useEffect(() => {
    if (!liveRef.current) return;
    const here = new Set(participants.map((p) => p.user_id));
    for (const id of [...peersRef.current.keys()])
      if (!here.has(id)) dropPeer(id);
    if (!policy.open) return;
    for (const p of participants) {
      if (p.user_id === selfID) continue;
      connectTo(p.user_id);
    }
  }, [participants, policy.open, selfID, dropPeer, connectTo]);

  // The watchdog. Signalling can be lost, an offer can cross a reconnect,
  // a connection can stall behind a carrier's NAT; none of it should leave
  // two players unable to hear each other with nothing happening about it.
  useEffect(() => {
    if (status !== "live") return;
    const timer = setInterval(() => {
      void (async () => {
        if (!liveRef.current || !policyRef.current.open) return;
        const now = Date.now();

        // Our own level, for the speaking light. Read from the sender's
        // statistics rather than the audio itself, which a phone will not
        // hand over cheaply.
        let mine = 0;
        const first = peersRef.current.values().next().value as
          | Peer
          | undefined;
        if (first) {
          try {
            const stats = await first.pc.getStats();
            stats.forEach((report: { type?: string; audioLevel?: number }) => {
              if (report.type === "media-source" && report.audioLevel)
                mine = Math.max(mine, report.audioLevel);
            });
          } catch {
            // Statistics are a nicety here.
          }
        }
        const loud = mine > 0.02 && !transmitRef.current.muted;
        setSpeaking((was) => (was === loud ? was : loud));

        for (const p of participantsRef.current) {
          if (p.user_id === selfRef.current) continue;
          const peer = peersRef.current.get(p.user_id);
          if (!peer) {
            connectRef.current(p.user_id);
            continue;
          }
          const state = String(peer.pc.connectionState);
          if (state !== "connected") {
            if (state === "failed" || now - peer.since > STALL_MS) {
              // Start again rather than nurse a connection that has not
              // come up: creating one offers again.
              dropPeer(p.user_id);
              connectRef.current(p.user_id);
            }
            continue;
          }
          peer.since = now;
          // Connected is not the same as audible. Count what has actually
          // arrived; a link that has gone quiet while the other player is
          // not muted is a link to rebuild.
          let received = 0;
          try {
            const stats = await peer.pc.getStats();
            stats.forEach(
              (report: {
                type?: string;
                kind?: string;
                packetsReceived?: number;
              }) => {
                if (report.type === "inbound-rtp" && report.kind !== "video")
                  received += report.packetsReceived ?? 0;
              },
            );
          } catch {
            continue;
          }
          if (received > peer.packets) {
            peer.packets = received;
            peer.heard = now;
            continue;
          }
          // A muted player legitimately sends almost nothing; they are not
          // a broken link.
          if (p.muted) {
            peer.heard = now;
            continue;
          }
          if (now - peer.heard > SILENT_MS) {
            dropPeer(p.user_id);
            connectRef.current(p.user_id);
          }
        }
      })();
    }, WATCHDOG_MS);
    return () => clearInterval(timer);
  }, [status, dropPeer]);

  // A closed phase stops transmission at once and takes the mesh down, so
  // nothing is left connected that could carry audio while it lasts.
  useEffect(() => {
    applyTransmit();
    if (policy.open || !liveRef.current) return;
    for (const id of [...peersRef.current.keys()]) {
      void signal(id, "bye", {});
      dropPeer(id);
    }
  }, [policy.open, applyTransmit, dropPeer, signal]);

  // The socket dropping takes the channel with it -- the server forgets a
  // membership when the connection closes -- so rejoin once it is back.
  useEffect(() => {
    if (!liveRef.current) return;
    if (connection === "live" && !joinedRef.current) {
      void (async () => {
        const room = roomRef.current;
        if (!room || !sendRef.current) return;
        for (const id of [...peersRef.current.keys()]) dropPeer(id);
        const reply = await sendRef.current(
          { type: "voice.join", room_id: room },
          true,
        );
        if (reply.type === "voice.joined") {
          joinedRef.current = true;
          setStatus("live");
        }
      })();
      return;
    }
    if (connection !== "live" && joinedRef.current) {
      joinedRef.current = false;
      setStatus("joining");
    }
  }, [connection, dropPeer]);

  // Leaving the room releases the microphone. Walking from the lobby to a
  // table does not: the room id is the same, which is the whole point of
  // playing a second game without dropping out of the call.
  useEffect(() => {
    if (roomID) return;
    if (liveRef.current) teardown("off");
  }, [roomID, teardown]);

  useEffect(
    () => () => {
      if (liveRef.current) teardown("off");
    },
    [teardown],
  );

  return {
    status,
    participants,
    policy,
    error,
    muted,
    deafened,
    speaking,
    links,
    join,
    leave,
    setMuted,
    setDeafened,
  };
}
