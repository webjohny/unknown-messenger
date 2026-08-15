import { env } from './env';
import { useAuthStore } from './auth-store';
import type {
  AuthTokens,
  AuthUser,
  CreatedInvite,
  InvitePreview,
  InviteSession,
  JoinRoomResponse,
  Message,
  Room,
} from './types';

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const response = await fetch(`${env.apiUrl}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  // A single transparent refresh: anything beyond that means the session is gone.
  if (response.status === 401 && retry) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) return request<T>(path, init, false);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(response.status, detail || response.statusText);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  register: (body: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => request<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  me: () => request<AuthUser>('/auth/me'),

  rooms: () => request<Room[]>('/rooms'),

  /** Link-only rooms, which `rooms()` deliberately leaves out. */
  anonRooms: () => request<Room[]>('/rooms/anon'),

  /** Works signed out — that is the whole point of an anonymous link. */
  createInvite: (body: { title?: string } = {}) =>
    request<CreatedInvite>('/invites', { method: 'POST', body: JSON.stringify(body) }),

  previewInvite: (token: string) => request<InvitePreview>(`/invites/${token}`),

  acceptInvite: (token: string) =>
    request<InviteSession>(`/invites/${token}/accept`, { method: 'POST' }),

  /** The link that opens a room, for a member who wants to pass it on. */
  roomInviteLink: (roomId: string) =>
    request<{ url: string } | null>(`/invites/room/${roomId}/link`),

  createRoom: (body: { title: string; type: Room['type']; memberIds: string[] }) =>
    request<Room>('/rooms', { method: 'POST', body: JSON.stringify(body) }),

  /** Idempotent — returns the existing 1:1 chat if it is already open. */
  openDirect: (userId: string) =>
    request<Room>('/rooms/direct', { method: 'POST', body: JSON.stringify({ userId }) }),

  messages: (roomId: string, cursor?: string) =>
    request<Message[]>(`/rooms/${roomId}/messages${cursor ? `?cursor=${cursor}` : ''}`),

  joinCall: (body: { roomId: string; viewerOnly?: boolean; enableTranscription?: boolean }) =>
    request<JoinRoomResponse>('/rooms/join', { method: 'POST', body: JSON.stringify(body) }),

  endCall: (roomName: string) =>
    request<{ ok: true }>(`/rooms/${roomName}/end`, { method: 'POST' }),

  searchUsers: (q: string) => request<AuthUser[]>(`/users/search?q=${encodeURIComponent(q)}`),

  /** Renames the caller — the only profile edit a guest has. */
  renameMe: (displayName: string) =>
    request<AuthUser>('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName }) }),
};

export { ApiError };
