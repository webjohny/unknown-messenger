export type RoomType = 'DIRECT' | 'GROUP' | 'STREAM' | 'ANON';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO_NOTE' | 'SYSTEM';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Minted by an invite link: no email, no password, no way to sign back in. */
  isGuest?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  body: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  sender: AuthUser;
  /** Present only on the echo of a locally sent message. */
  clientId?: string;
}

/** Newest message of a room, as returned with the room list. */
export interface RoomPreview {
  id: string;
  body: string;
  type: MessageType;
  createdAt: string;
  senderId: string;
  senderName: string;
}

export interface Room {
  id: string;
  name: string;
  title: string;
  type: RoomType;
  createdAt: string;
  members: { id: string; userId: string; role: string; user: AuthUser }[];
  /** Null in a room where nobody has said anything yet. */
  lastMessage?: RoomPreview | null;
}

/**
 * The result of creating or opening an invite link. `tokens` arrives only when
 * the call minted a guest for the caller — a signed-in user keeps the session
 * they already had.
 */
export interface InviteSession {
  roomId: string;
  room: Room;
  tokens: AuthTokens | null;
  actingAs: { id: string; username: string; displayName: string; isGuest: boolean };
}

export interface CreatedInvite extends InviteSession {
  token: string;
  url: string;
}

export interface InvitePreview {
  valid: boolean;
  title: string | null;
  memberCount: number;
  expiresAt: string | null;
}

export interface JoinRoomResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  callSessionId: string;
}

/** Frame published by media-ai-service on the `captions` data-channel topic. */
export interface Caption {
  participantId: string;
  participantName: string;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  language?: string;
  confidence?: number;
}

export interface TypingEvent {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface PresenceEvent {
  userId: string;
  online: boolean;
  at: string;
}
