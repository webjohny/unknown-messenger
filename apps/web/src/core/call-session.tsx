import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { api } from '@/lib/api';
import type { JoinRoomResponse } from '@/lib/types';

type EndListener = (durationMs: number | null) => void;

export interface CallSession {
  /** The room the live call belongs to, or null when there is no call. */
  roomId: string | null;
  /** Null until the token arrives; skins render their own placeholder. */
  connection: JoinRoomResponse | null;
  connecting: boolean;
  error: string | null;
  /** Opens a call. Only the side that opens one reports its duration. */
  start: (roomId: string) => void;
  /** Walks into a call somebody else opened. */
  join: (roomId: string) => void;
  leave: () => void;
  /**
   * Fires once per call that ends — however it ended — with the duration when
   * this client opened it and null when it only walked in. Returns the
   * unsubscribe, so an effect can return it directly.
   */
  onEnded: (listener: EndListener) => () => void;
}

const CallSessionContext = createContext<CallSession | null>(null);

/**
 * Owns the LiveKit session for the whole app, mounted above the skin.
 *
 * A skin swap replaces every component below it: `SkinEngine` renders a
 * different component type, so React drops the old tree instead of updating it.
 * With the call living inside a skin that meant the `LiveKitRoom` was unmounted
 * mid-call, the socket closed, the camera released and a fresh token fetched —
 * the call dropped for both sides just because somebody changed the theme.
 *
 * So the session sits here instead. Skins draw tiles and buttons against a room
 * that outlives them; remounting a `<video>` element re-attaches an existing
 * track, which costs a frame instead of a reconnect.
 */
export function CallSessionProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connection, setConnection] = useState<JoinRoomResponse | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of the state for the callbacks, which must not close over a render.
  const roomIdRef = useRef<string | null>(null);
  const connectionRef = useRef<JoinRoomResponse | null>(null);
  // Set only for the side that opened the call — the one that reports how long
  // it ran. A walk-in leaves it null and stays quiet.
  const openedAt = useRef<number | null>(null);
  // Bumped on every start and every end, so a token that arrives for a call
  // that is already over cannot connect us to it.
  const attempt = useRef(0);
  const listeners = useRef(new Set<EndListener>());

  const begin = useCallback((next: string, opener: boolean) => {
    if (roomIdRef.current === next) return;

    const id = ++attempt.current;
    roomIdRef.current = next;
    connectionRef.current = null;
    openedAt.current = opener ? Date.now() : null;

    setRoomId(next);
    setConnection(null);
    setConnecting(true);
    setError(null);

    api
      .joinCall({ roomId: next, viewerOnly: false, enableTranscription: true })
      .then((result) => {
        if (attempt.current !== id) return;
        connectionRef.current = result;
        setConnection(result);
        setConnecting(false);
      })
      .catch((err: Error) => {
        if (attempt.current !== id) return;
        setError(err.message);
        setConnecting(false);
      });
  }, []);

  const start = useCallback((next: string) => begin(next, true), [begin]);
  const join = useCallback((next: string) => begin(next, false), [begin]);

  // Called both by a hang-up and by LiveKit's own disconnect — which the
  // hang-up triggers in turn — so it has to be safe to run twice.
  const end = useCallback(() => {
    if (roomIdRef.current === null) return;

    attempt.current += 1;
    const closing = connectionRef.current;
    const opened = openedAt.current;

    roomIdRef.current = null;
    connectionRef.current = null;
    openedAt.current = null;

    setRoomId(null);
    setConnection(null);
    setConnecting(false);
    setError(null);

    if (closing) void api.endCall(closing.roomName).catch(() => undefined);

    const duration = opened === null ? null : Date.now() - opened;
    for (const listener of listeners.current) listener(duration);
  }, []);

  const onEnded = useCallback((listener: EndListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo<CallSession>(
    () => ({ roomId, connection, connecting, error, start, join, leave: end, onEnded }),
    [roomId, connection, connecting, error, start, join, end, onEnded],
  );

  return (
    <CallSessionContext.Provider value={value}>
      {/* Mounted at all times, connected only when there is a token: swapping
          this element in and out would re-parent the entire app and remount it,
          which is the very thing this provider exists to prevent. It lays out
          as nothing — the skin owns every box the user can see. */}
      <LiveKitRoom
        token={connection?.token}
        serverUrl={connection?.url}
        connect={Boolean(connection)}
        audio
        video
        onDisconnected={end}
        style={{ display: 'contents' }}
      >
        {children}
        <RoomAudioRenderer />
      </LiveKitRoom>
    </CallSessionContext.Provider>
  );
}

export function useCallSession(): CallSession {
  const ctx = useContext(CallSessionContext);
  if (!ctx) throw new Error('useCallSession must be used inside <CallSessionProvider>');
  return ctx;
}
