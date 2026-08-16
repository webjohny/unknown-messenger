import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

import { useNavigation } from './navigation';

/**
 * A guest owns exactly one thing: the anonymous room they were invited to. That
 * room is kept out of the chat list by design, so the home screen would show a
 * guest an empty app and no way back — this puts them where they came from.
 *
 * `active` is a flag rather than a caller-side condition because hooks cannot
 * be skipped; pass false and the query never runs.
 */
export function useGuestHomeRedirect(active: boolean): void {
  const { replace } = useNavigation();
  const isGuest = useAuthStore((s) => s.user?.isGuest ?? false);

  const enabled = active && isGuest;
  const anon = useQuery({ queryKey: ['rooms', 'anon'], queryFn: api.anonRooms, enabled });

  useEffect(() => {
    // Newest first, as the API returns them: the room they just joined.
    const first = anon.data?.[0];
    if (enabled && first) replace(`/room/${first.id}`);
  }, [enabled, anon.data, replace]);
}
