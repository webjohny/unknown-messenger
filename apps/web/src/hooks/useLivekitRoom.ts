'use client';

import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { JoinRoomResponse } from '@/lib/types';

interface UseLivekitRoom {
  connection: JoinRoomResponse | null;
  loading: boolean;
  error: string | null;
  leave: () => Promise<void>;
}

/**
 * Fetches a LiveKit access token from api-core. The token is short-lived and
 * scoped to a single room, so it is requested per join rather than cached.
 */
export function useLivekitRoom(
  roomId: string,
  options: { viewerOnly?: boolean; enableTranscription?: boolean } = {},
): UseLivekitRoom {
  const { viewerOnly = false, enableTranscription = true } = options;

  const [connection, setConnection] = useState<JoinRoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .joinCall({ roomId, viewerOnly, enableTranscription })
      .then((result) => {
        if (!cancelled) setConnection(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, viewerOnly, enableTranscription]);

  const leave = useCallback(async () => {
    if (!connection) return;
    await api.endCall(connection.roomName).catch(() => undefined);
    setConnection(null);
  }, [connection]);

  return { connection, loading, error, leave };
}
