'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { useAuthStore } from '@/lib/auth-store';
import { env } from '@/lib/env';

interface SessionSocket {
  socket: Socket | null;
  connected: boolean;
}

const SessionSocketContext = createContext<SessionSocket>({ socket: null, connected: false });

/** How long an auth failure waits before another refresh is attempted. */
const REFRESH_COOLDOWN_MS = 5_000;

/**
 * One socket per signed-in session, alive for as long as the user is — not for
 * as long as a room is open. Server-side notifications are delivered to a
 * personal `user:<id>` channel (a new chat someone else started, for one), so a
 * client that only connects while viewing a room never hears about them.
 *
 * Reconnecting is not enough on its own: whatever happened during the gap was
 * only written to the database, never delivered. So every reconnect — and every
 * return to a backgrounded tab — also refetches, and the socket's own auth is
 * refreshed when the access token expires mid-session.
 */
export function SessionSocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const next = io(`${env.wsUrl}/ws`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: Infinity,
      // Retry quickly at first — most drops are a sleeping laptop or a switched
      // network, and are over by the time the first attempt lands.
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 8_000,
    });

    /** Refetch what the socket could not deliver while it was down. */
    const resync = () => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
    };

    // Only a real gap needs a resync; the first connect has nothing to catch up on.
    let droppedAt: number | null = null;
    let lastRefreshAt = 0;

    const onConnect = () => {
      setConnected(true);
      if (droppedAt !== null) {
        droppedAt = null;
        resync();
      }
    };

    const onDisconnect = () => {
      droppedAt = Date.now();
      setConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error('[ws] connect_error:', err.message);

      // An expired access token fails the handshake the same way every retry
      // would, so back-off alone never recovers: refresh, and the new token
      // re-creates this socket through the store.
      const looksLikeAuth = /jwt|token|unauthor|expired|missing/i.test(err.message);
      if (!looksLikeAuth || Date.now() - lastRefreshAt < REFRESH_COOLDOWN_MS) return;

      lastRefreshAt = Date.now();
      void useAuthStore.getState().refresh();
    };

    next.on('connect', onConnect);
    next.on('disconnect', onDisconnect);
    next.on('connect_error', onConnectError);
    // Nest emits this when a handler throws (validation, guards, service errors).
    next.on('exception', (err) => console.error('[ws] exception:', err));

    /**
     * A tab that was hidden or a machine that slept can hold a socket that is
     * dead but not yet timed out, and can miss events even while it stays
     * "connected". On the way back: reconnect if needed, resync either way.
     */
    const wake = () => {
      // Reconnect regardless of visibility — a background tab still has to
      // receive messages. Refetching, though, can wait until someone is
      // looking: visibilitychange fires on the way back and resyncs then.
      if (!next.connected) {
        droppedAt = droppedAt ?? Date.now();
        next.connect();
        return;
      }
      if (document.visibilityState === 'visible') resync();
    };

    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);

    setSocket(next);

    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      next.removeAllListeners();
      next.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken, queryClient]);

  const value = useMemo<SessionSocket>(() => ({ socket, connected }), [socket, connected]);

  return (
    <SessionSocketContext.Provider value={value}>{children}</SessionSocketContext.Provider>
  );
}

export function useSessionSocket(): SessionSocket {
  return useContext(SessionSocketContext);
}
