import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { peerOf, roomTitle } from '@/lib/room-display';
import type { AuthUser, Message } from '@/lib/types';

import { useCallSession } from './call-session';
import { useChatPlayback, type PlaybackCue } from './chat-playback';

import { useNavigation } from './navigation';

/**
 * A call announcement posted into the thread. Skins draw it instead of a
 * message bubble — the wording is decided here so all eleven of them agree.
 */
export interface CallNotice {
  kind: 'started' | 'ended';
  /** The line to print, e.g. "Відеосесія розпочалась". */
  text: string;
  /** How long the call ran, e.g. "3 хв 12 с" — on an `ended` notice only. */
  duration: string | null;
  /** The invitation, on a live start only — an old call must not still ask. */
  hint: string | null;
  /** A start nobody has closed yet: the only case worth offering a join button. */
  live: boolean;
}

/** A message with the "is it mine" question already answered. */
export interface RoomMessage extends Message {
  own: boolean;
  /** `HH:MM`, formatted once here so skins do not each reinvent it. */
  time: string;
  /** Set when the message is a call announcement rather than something said. */
  call: CallNotice | null;
  /** Whether this viewer may retire it — the author, and nobody else. */
  canDelete: boolean;
}

export interface RoomController {
  title: string;
  peer: AuthUser | null;
  messages: RoomMessage[];
  loadingHistory: boolean;
  connected: boolean;
  /** Display names currently typing, empty when nobody is. */
  typing: string[];
  draft: string;
  setDraft: (value: string) => void;
  send: () => void;
  /** Takes the message out of the thread for everyone. Only own messages. */
  deleteMessage: (messageId: string) => void;
  inCall: boolean;
  toggleCall: () => void;
  /** Join a call somebody else started — announces nothing, just walks in. */
  joinCall: () => void;
  leave: () => void;
  /** Attach to the element that should stay pinned to the newest message. */
  bottomRef: React.RefObject<HTMLDivElement>;
}

export function useRoomController(roomId: string): RoomController {
  const nav = useNavigation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  // The call itself lives above the skin, so that changing skin — which
  // rebuilds this hook and everything around it — cannot drop it. That makes
  // "am I in a call" a question about the session, not local state.
  const call = useCallSession();
  const inCall = call.roomId === roomId;

  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: api.rooms,
    enabled: Boolean(accessToken),
  });
  // An anonymous room is deliberately absent from the chat list, so the list
  // alone cannot name the room the user is standing in — without this the
  // header of every invite room reads "Завантаження…" forever.
  const anonRooms = useQuery({
    queryKey: ['rooms', 'anon'],
    queryFn: api.anonRooms,
    enabled: Boolean(accessToken),
  });
  const history = useQuery({
    queryKey: ['messages', roomId],
    queryFn: () => api.messages(roomId),
    enabled: Boolean(accessToken),
  });

  const { connected, messages, deletedIds, typingUsers, sendMessage, deleteMessage, setTyping } =
    useChatSocket(roomId, history.data ?? []);

  const room =
    rooms.data?.find((candidate) => candidate.id === roomId) ??
    anonRooms.data?.find((candidate) => candidate.id === roomId) ??
    null;

  // The socket hook seeds its list once, on mount, but the history request
  // usually finishes after that — so the two have to be merged here or the
  // thread shows only what arrived live. Keyed by id, live copy wins: that is
  // what replaces an optimistic message with the server's echo.
  // A deleted message has to be dropped after the merge, not before: the fetched
  // history is a cache that still remembers it, so filtering one source alone
  // would let the other one put it back.
  const timeline = useMemo(() => {
    const byId = new Map<string, Message>();
    for (const message of history.data ?? []) byId.set(message.id, message);
    for (const message of messages) byId.set(message.id, message);
    for (const id of deletedIds) byId.delete(id);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [history.data, messages, deletedIds]);

  const allMessages = useMemo<RoomMessage[]>(
    () =>
      withCallNotices(timeline).map(({ message, call: notice }) => ({
        ...message,
        own: message.senderId === user?.id,
        time: new Date(message.createdAt).toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        call: notice,
        // A call announcement is written by the room, not by the person whose
        // name is on it, and removing one would leave the other half of the pair
        // hanging — so it is nobody's to delete.
        canDelete: message.senderId === user?.id && !notice,
      })),
    [timeline, user?.id],
  );

  // Playback replays the tail of the thread for the camera. It only ever hides
  // lines that are already here, so a skin needs to know nothing about it: it
  // renders `messages` and `typing` exactly as before.
  const playback = useChatPlayback();
  const { sync: syncPlayback } = playback;

  const cues = useMemo<PlaybackCue[]>(
    () =>
      allMessages.map((message) => ({
        length: message.body.length,
        // A call notice is not typed by anyone, so nobody should appear to be
        // typing it.
        author: message.call ? null : (message.sender?.displayName ?? null),
      })),
    [allMessages],
  );

  useEffect(() => syncPlayback(roomId, cues), [roomId, cues, syncPlayback]);

  const visibleMessages = useMemo(
    () => (playback.hidden > 0 ? allMessages.slice(0, allMessages.length - playback.hidden) : allMessages),
    [allMessages, playback.hidden],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft('');
    setTyping(false);
  };

  const startCall = () => {
    call.start(roomId);
    sendMessage('Відеосесія розпочалась', {
      type: 'SYSTEM',
      meta: { kind: 'call.started' },
    });
  };

  // Closing the thread's announcement is the session's cue, not the button's:
  // a call also ends when LiveKit drops, and both have to read the same. Only
  // the side that opened it gets a duration, and only that side reports.
  const { onEnded } = call;
  useEffect(
    () =>
      onEnded((durationMs) => {
        if (durationMs === null) return;
        sendMessage('Відеосесію завершено', {
          type: 'SYSTEM',
          meta: { kind: 'call.ended', durationMs },
        });
      }),
    [onEnded, sendMessage],
  );

  return {
    title: room ? roomTitle(room, user?.id) : 'Завантаження…',
    peer: room ? peerOf(room, user?.id) : null,
    messages: visibleMessages,
    loadingHistory: history.isLoading,
    connected,
    // During a take the indicator belongs to whoever is about to "send" the next
    // line; the real one would be empty anyway, since nobody is really typing.
    typing: playback.typingName ? [playback.typingName] : typingUsers,
    draft,
    setDraft: (value) => {
      setDraft(value);
      setTyping(value.length > 0);
    },
    send,
    deleteMessage,
    inCall,
    toggleCall: () => (inCall ? call.leave() : startCall()),
    joinCall: () => call.join(roomId),
    leave: () => nav.push('/'),
    bottomRef,
  };
}

/**
 * Reads the call announcements out of the timeline. A start stays "live" until
 * an end follows it, which is what decides whether a join button is worth
 * drawing — an invitation to a call that is over is only in the way.
 */
function withCallNotices(timeline: Message[]): { message: Message; call: CallNotice | null }[] {
  let liveIndex: number | null = null;

  const rows = timeline.map((message, index) => {
    const kind = (message.meta as { kind?: string } | null)?.kind;

    if (kind === 'call.started') {
      liveIndex = index;
      return {
        message,
        call: {
          kind: 'started',
          text: message.body,
          duration: null,
          hint: null,
          live: false,
        } as CallNotice,
      };
    }

    if (kind === 'call.ended') {
      liveIndex = null;
      const ms = Number((message.meta as { durationMs?: unknown } | null)?.durationMs ?? 0);
      return {
        message,
        call: {
          kind: 'ended',
          text: message.body,
          duration: ms > 0 ? formatDuration(ms) : null,
          hint: null,
          live: false,
        } as CallNotice,
      };
    }

    return { message, call: null };
  });

  if (liveIndex !== null) {
    rows[liveIndex].call = {
      ...rows[liveIndex].call!,
      hint: 'Не хочете підключитись?',
      live: true,
    };
  }
  return rows;
}

/** "45 с", "3 хв 12 с", "1 год 05 хв" — long enough to be useful, no longer. */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours} год ${String(minutes).padStart(2, '0')} хв`;
  if (minutes > 0) return `${minutes} хв ${String(seconds).padStart(2, '0')} с`;
  return `${seconds} с`;
}
