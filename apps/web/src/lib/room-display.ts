import type { AuthUser, Room } from './types';

/** The other side of a 1:1 chat, or null for group rooms and streams. */
export function peerOf(room: Room, currentUserId: string | undefined): AuthUser | null {
  if (room.type !== 'DIRECT' || !currentUserId) return null;
  return room.members.find((member) => member.userId !== currentUserId)?.user ?? null;
}

/** Direct chats are labelled by the peer, so both sides see a different title. */
export function roomTitle(room: Room, currentUserId: string | undefined): string {
  return peerOf(room, currentUserId)?.displayName ?? room.title;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
