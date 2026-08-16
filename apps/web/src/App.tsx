import { useEffect } from 'react';

import {
  useCallSession,
  useGuestHomeRedirect,
  useNavigation,
  useSessionController,
} from '@/core';
import { SkinEngine, type SkinView } from '@/skin-engine';

const ROOM_PATH = /^\/room\/([^/?#]+)/;
const INVITE_PATH = /^\/invite\/([^/?#]+)/;

/**
 * The whole app, mounted once for every URL.
 *
 * There are deliberately no route components: the skin owns the entire screen,
 * so handing each path its own element would drop and rebuild that screen on
 * every navigation — losing its DOM, its scroll positions and any animation in
 * flight. The view is therefore derived from the path instead, and the router
 * is only asked what the path is.
 */
export function App() {
  const { pathname, replace } = useNavigation();
  const { ready, signedIn } = useSessionController();
  const call = useCallSession();

  const roomId = ROOM_PATH.exec(pathname)?.[1] ?? null;
  const inviteToken = INVITE_PATH.exec(pathname)?.[1] ?? null;

  useEffect(() => {
    if (ready && !signedIn && roomId) replace('/');
  }, [ready, signedIn, roomId, replace]);

  // Walking out of the room hangs up. The call session deliberately outlives
  // the skin — that is what keeps a call alive across a skin change — so the
  // URL, which this component tracks and a skin swap does not touch, is what
  // decides when the call is actually over.
  const { roomId: callRoomId, leave } = call;
  useEffect(() => {
    if (callRoomId && callRoomId !== roomId) leave();
  }, [callRoomId, roomId, leave]);

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
