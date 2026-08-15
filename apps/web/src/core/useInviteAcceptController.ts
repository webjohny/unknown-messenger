'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';
import { useAuthHydrated, useAuthStore } from '@/lib/auth-store';

import { adoptSession } from './useInviteController';

export type InviteAcceptStatus = 'joining' | 'failed';

export interface InviteAcceptController {
  status: InviteAcceptStatus;
  error: string | null;
}

/**
 * Opening an invite link is not a decision to confirm — the decision was made
 * by clicking it — so this joins straight away and redirects into the room. A
 * visitor who is already signed in keeps their name; anyone else is given a
 * guest one on the way in.
 */
export function useInviteAcceptController(token: string): InviteAcceptController {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSession, setUser } = useAuthStore();
  const hydrated = useAuthHydrated();

  const [status, setStatus] = useState<InviteAcceptStatus>('joining');
  const [error, setError] = useState<string | null>(null);

  // React runs effects twice in development; a second accept would mint a
  // second guest and post a second "joined" line.
  const started = useRef(false);

  useEffect(() => {
    // Accepting before the persisted session is read would sign a returning
    // user in as a stranger to their own chat.
    if (!hydrated || started.current) return;
    started.current = true;

    void (async () => {
      try {
        const session = await api.acceptInvite(token);
        if (session.tokens) await adoptSession(session.tokens, setSession, setUser);

        await queryClient.invalidateQueries({ queryKey: ['rooms'] });
        router.replace(`/room/${session.roomId}`);
      } catch (err) {
        setError(readableError((err as Error).message));
        setStatus('failed');
      }
    })();
  }, [hydrated, token, router, queryClient, setSession, setUser]);

  return { status, error };
}

function readableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON — fall through */
  }
  return raw || 'Посилання більше не працює';
}
