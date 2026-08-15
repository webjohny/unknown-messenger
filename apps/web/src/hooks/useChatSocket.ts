'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSessionSocket } from '@/core/socket';
import { useAuthStore } from '@/lib/auth-store';
import type { Message, MessageType, PresenceEvent, TypingEvent } from '@/lib/types';

/** Everything a message can carry beyond its text. */
export interface SendOptions {
  type?: MessageType;
  meta?: Record<string, unknown>;
}

interface UseChatSocket {
  connected: boolean;
  messages: Message[];
  typingUsers: string[];
  onlineUsers: Set<string>;
  sendMessage: (body: string, options?: SendOptions) => void;
  setTyping: (isTyping: boolean) => void;
}

/**
 * Room-scoped view of the session socket: joins the room, collects what arrives
 * for it, and sends. The connection itself belongs to the session, so leaving a
 * room never drops the notifications that arrive outside of one.
 */
export function useChatSocket(roomId: string | null, initialMessages: Message[] = []): UseChatSocket {
  const { socket, connected } = useSessionSocket();
  const currentUser = useAuthStore((s) => s.user);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !roomId) return;

    // The socket outlives the room, so anything collected for the previous one
    // has to go or it bleeds into this room's thread.
    setMessages([]);
    setTypingUsers([]);

    const join = () => socket.emit('room:join', { roomId });
    if (socket.connected) join();

    const onMessage = (message: Message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => {
        // Replace the optimistic copy when the server echoes our own message.
        const withoutOptimistic = message.clientId
          ? prev.filter((m) => m.id !== message.clientId)
          : prev;
        if (withoutOptimistic.some((m) => m.id === message.id)) return withoutOptimistic;
        return [...withoutOptimistic, message];
      });
    };

    const onTyping = (event: TypingEvent) => {
      if (event.roomId !== roomId) return;
      setTypingUsers((prev) => {
        const next = prev.filter((u) => u !== event.username);
        return event.isTyping ? [...next, event.username] : next;
      });
    };

    const onPresence = (event: PresenceEvent) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (event.online) next.add(event.userId);
        else next.delete(event.userId);
        return next;
      });
    };

    socket.on('connect', join);
    socket.on('message:new', onMessage);
    socket.on('presence:typing', onTyping);
    socket.on('presence:update', onPresence);

    return () => {
      socket.off('connect', join);
      socket.off('message:new', onMessage);
      socket.off('presence:typing', onTyping);
      socket.off('presence:update', onPresence);
    };
  }, [socket, roomId]);

  const sendMessage = useCallback(
    (body: string, options: SendOptions = {}) => {
      if (!socket || !roomId || !currentUser || !body.trim()) {
        console.error('[ws] send skipped', {
          socket: Boolean(socket),
          roomId,
          user: Boolean(currentUser),
        });
        return;
      }

      const clientId = crypto.randomUUID();
      const optimistic: Message = {
        id: clientId,
        roomId,
        senderId: currentUser.id,
        type: options.type ?? 'TEXT',
        body,
        meta: options.meta ?? null,
        createdAt: new Date().toISOString(),
        sender: currentUser,
      };
      setMessages((prev) => [...prev, optimistic]);

      socket.emit(
        'message:send',
        { roomId, body, clientId, type: options.type, meta: options.meta },
        (ack: { ok: boolean } | undefined) => {
          if (!ack?.ok) {
            console.error('[ws] message rejected:', ack);
            setMessages((prev) => prev.filter((m) => m.id !== clientId));
          }
        },
      );
    },
    [socket, roomId, currentUser],
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !roomId) return;

      socket.emit('presence:typing', { roomId, isTyping });

      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (isTyping) {
        // Auto-clear so a user who stops typing without blurring is not stuck.
        typingTimeout.current = setTimeout(() => {
          socket.emit('presence:typing', { roomId, isTyping: false });
        }, 3000);
      }
    },
    [socket, roomId],
  );

  return { connected, messages, typingUsers, onlineUsers, sendMessage, setTyping };
}
