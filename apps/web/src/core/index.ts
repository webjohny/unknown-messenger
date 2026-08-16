/**
 * The headless core. Everything a skin needs to *work* lives here; nothing that
 * decides how it *looks* does. Skins import from `@/core` only — they never
 * import each other, and no module outside a skin may pass it a class name, a
 * style object or a colour.
 */

export { SessionSocketProvider, useSessionSocket } from './socket';
export { CallSessionProvider, useCallSession } from './call-session';
export { AppLink, useNavigation } from './navigation';
export { useSessionController } from './useSessionController';
export { useAuthController } from './useAuthController';
export { useChatListController } from './useChatListController';
export { useGuestHomeRedirect } from './useGuestHome';
export { useIdentityController } from './useIdentityController';
export { useInviteController } from './useInviteController';
export { useInviteAcceptController } from './useInviteAcceptController';
export { useRoomController } from './useRoomController';
export {
  useCallController,
  useCallControls,
  CallRoot,
  useCallStage,
  useCaptionFeed,
  VideoTrack,
  isTrackReference,
} from './useCallController';
export { useCallExpansion, CallOverlay } from './useCallExpansion';

export { initials, peerOf, roomTitle } from '@/lib/room-display';

export type { AuthMode, AuthController } from './useAuthController';
export type { SessionController } from './useSessionController';
export type { ChatListController, ChatListEntry } from './useChatListController';
export type { IdentityController } from './useIdentityController';
export type { InviteController } from './useInviteController';
export type { InviteAcceptController, InviteAcceptStatus } from './useInviteAcceptController';
export type { RoomController, CallNotice } from './useRoomController';
export type { CallSession } from './call-session';
export type { Navigation } from './navigation';
export type { CallController, CallControls, CallStage } from './useCallController';
export type { CallExpansion } from './useCallExpansion';
export type { RoomMessage } from './useRoomController';
export type { CaptionLine } from '@/hooks/useCaptions';
export type { AuthUser, Message, Room, RoomType } from '@/lib/types';
