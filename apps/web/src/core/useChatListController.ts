'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useUserSearch } from '@/hooks/useUserSearch';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { roomTitle, peerOf } from '@/lib/room-display';
import type { AuthUser, Message, Room } from '@/lib/types';

import { useSessionSocket } from './socket';

/** One line in a skin's sidebar, already resolved to display data. */
export interface ChatListEntry {
  id: string;
  name: string;
  subtitle: string;
  avatarUrl: string | null;
  /** Newest message, ready to show as a preview; null in an empty chat. */
  preview: {
    text: string;
    own: boolean;
    /** `HH:MM` of the newest message. */
    time: string;
    at: string;
  } | null;
  /** Open chats navigate; search hits have to be created first. */
  href: string | null;
  open: () => void;
}

export interface ChatListController {
  term: string;
  setTerm: (term: string) => void;
  searching: boolean;
  chats: ChatListEntry[];
  people: ChatListEntry[];
  loadingChats: boolean;
  loadingPeople: boolean;
  opening: boolean;
  openFailed: boolean;
}

export function useChatListController(): ChatListController {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [term, setTerm] = useState('');

  const rooms = useQuery({ queryKey: ['rooms'], queryFn: api.rooms });
  const found = useUserSearch(term);

  const { socket } = useSessionSocket();

  // When someone else opens a chat with this user, the server announces it on
  // the personal channel. Without this the new chat only appears on reload.
  useEffect(() => {
    if (!socket) return;

    const refreshRooms = () => void queryClient.invalidateQueries({ queryKey: ['rooms'] });

    // A new message only changes one field of one room, so patch the cache
    // instead of refetching the whole list on every line anyone types.
    const patchPreview = (message: Message) => {
      queryClient.setQueryData<Room[]>(['rooms'], (rooms) =>
        rooms?.map((room) =>
          room.id === message.roomId
            ? {
                ...room,
                lastMessage: {
                  id: message.id,
                  body: message.body,
                  type: message.type,
                  createdAt: message.createdAt,
                  senderId: message.senderId,
                  senderName: message.sender.displayName,
                },
              }
            : room,
        ),
      );
    };

    socket.on('room:created', refreshRooms);
    socket.on('message:new', patchPreview);
    return () => {
      socket.off('room:created', refreshRooms);
      socket.off('message:new', patchPreview);
    };
  }, [socket, queryClient]);

  const openChat = useMutation({
    mutationFn: (peerId: string) => api.openDirect(peerId),
    onSuccess: async (room: Room) => {
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setTerm('');
      router.push(`/room/${room.id}`);
    },
  });

  const allRooms = rooms.data ?? [];
  const needle = term.trim().toLowerCase();

  const chats: ChatListEntry[] = allRooms
    .filter((room) => !needle || roomTitle(room, user?.id).toLowerCase().includes(needle))
    .map((room) => {
      const peer = peerOf(room, user?.id);
      return {
        id: room.id,
        name: roomTitle(room, user?.id),
        subtitle: peer ? `@${peer.username}` : `${room.type} · ${room.members.length} учасників`,
        avatarUrl: peer?.avatarUrl ?? null,
        preview: toPreview(room, user?.id),
        href: `/room/${room.id}`,
        open: () => router.push(`/room/${room.id}`),
      };
    });

  // Someone already in an open chat belongs to the list above, not to "new".
  const knownPeerIds = new Set(allRooms.flatMap((room) => room.members.map((m) => m.userId)));

  const people: ChatListEntry[] = (found.data ?? [])
    .filter((person: AuthUser) => person.id !== user?.id && !knownPeerIds.has(person.id))
    .map((person: AuthUser) => ({
      id: person.id,
      name: person.displayName,
      subtitle: `@${person.username}`,
      avatarUrl: person.avatarUrl,
      preview: null,
      href: null,
      open: () => openChat.mutate(person.id),
    }));

  return {
    term,
    setTerm,
    searching: needle.length >= 2,
    chats,
    people,
    loadingChats: rooms.isLoading,
    loadingPeople: found.isFetching,
    opening: openChat.isPending,
    openFailed: openChat.isError,
  };
}

/** Labels for messages that have no text of their own to preview. */
const TYPE_LABEL: Record<string, string> = {
  IMAGE: 'Фото',
  FILE: 'Файл',
  VIDEO_NOTE: 'Відеоповідомлення',
  SYSTEM: 'Системне повідомлення',
};

function toPreview(room: Room, currentUserId: string | undefined): ChatListEntry['preview'] {
  const last = room.lastMessage;
  if (!last) return null;

  const at = new Date(last.createdAt);
  return {
    text: last.type === 'TEXT' ? last.body : (TYPE_LABEL[last.type] ?? last.body),
    own: last.senderId === currentUserId,
    time: at.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
    at: last.createdAt,
  };
}
