'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useGuestHomeRedirect, useSessionController } from '@/core';
import { SkinEngine, type SkinView } from '@/skin-engine';

const ROOM_PATH = /^\/room\/([^/?#]+)/;
const INVITE_PATH = /^\/invite\/([^/?#]+)/;

/**
 * Mounted by the root layout, which survives navigation — so switching between
 * the chat list and a room re-renders the skin instead of tearing it down and
 * building it again. Rendering this from the page components instead made every
 * URL change flash: React dropped the whole skin subtree, losing its DOM, its
 * scroll positions and any animation in flight.
 *
 * The view therefore comes from the URL rather than from a page, and the pages
 * exist only to make the routes resolvable.
 */
export function SkinHost() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, signedIn } = useSessionController();

  const roomId = ROOM_PATH.exec(pathname ?? '')?.[1] ?? null;
  const inviteToken = INVITE_PATH.exec(pathname ?? '')?.[1] ?? null;

  useEffect(() => {
    if (ready && !signedIn && roomId) router.replace('/');
  }, [ready, signedIn, roomId, router]);

  // A guest landing on the home screen has an empty chat list and no way back
  // to the one room they belong to; this returns them to it.
  useGuestHomeRedirect(ready && signedIn && !roomId && !inviteToken);

  // Nothing is drawn before the session is known: the core has no look of its
  // own to show, and guessing would flash the wrong screen at a signed-in user.
  if (!ready) return null;

  // An invite outranks the sign-in screen. Whoever followed the link has no
  // account by assumption, and asking them to make one is the one thing this
  // whole flow exists to avoid.
  const view: SkinView = inviteToken
    ? { name: 'invite', token: inviteToken }
    : !signedIn
      ? { name: 'auth' }
      : roomId
        ? { name: 'room', roomId }
        : { name: 'home' };

  return <SkinEngine view={view} />;
}
