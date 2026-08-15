'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { AuthTokens } from '@/lib/types';

export interface InviteController {
  /**
   * Creates the anonymous room and walks the caller into it. Works signed out:
   * a guest identity is minted server-side and adopted here.
   */
  create: () => Promise<void>;
  /** The link to the room that was just created, once there is one. */
  link: string | null;
  /** True for a few seconds after the link reached the clipboard. */
  copied: boolean;
  copy: () => Promise<void>;
  pending: boolean;
  error: string | null;
}

/**
 * The anonymous-link flow, with no opinion about how the button looks. A skin
 * decides where to put it; this decides what it does.
 */
export function useInviteController(): InviteController {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSession, setUser } = useAuthStore();

  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(
    async (value = link) => {
      if (!value) return;
      const ok = await copyToClipboard(value);
      setCopied(ok);
      if (ok) setTimeout(() => setCopied(false), 2500);
    },
    [link],
  );

  const create = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const invite = await api.createInvite();

      // Only a brand-new guest comes back with tokens; adopting them for a
      // signed-in caller would swap their account for an anonymous one.
      if (invite.tokens) await adoptSession(invite.tokens, setSession, setUser);

      setLink(invite.url);
      // The whole point is to send this to someone, so save the paste.
      void copy(invite.url);

      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      router.push(`/room/${invite.roomId}`);
    } catch (err) {
      setError(readableError((err as Error).message));
    } finally {
      setPending(false);
    }
  }, [copy, queryClient, router, setSession, setUser]);

  return { create, link, copied, copy: () => copy(), pending, error };
}

/**
 * Takes on the identity the server just handed out. `api.me()` rather than the
 * response body, so the stored user is the same shape every other screen reads.
 */
export async function adoptSession(
  tokens: AuthTokens,
  setSession: (tokens: AuthTokens) => void,
  setUser: (user: Awaited<ReturnType<typeof api.me>>) => void,
): Promise<void> {
  setSession(tokens);
  setUser(await api.me());
}

/** Clipboard access needs a secure context and a permission; neither is given. */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** The API returns raw Nest error bodies; surface the message, not the JSON. */
function readableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON — fall through */
  }
  return raw || 'Не вдалося створити посилання';
}
