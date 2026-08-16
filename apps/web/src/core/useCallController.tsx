import {
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useMemo } from 'react';

import { useCaptions, type CaptionLine } from '@/hooks/useCaptions';

import { useCallSession } from './call-session';

export interface CallController {
  connecting: boolean;
  error: string | null;
  /** Null until the token arrives; skins render their own placeholder. */
  connection: { token: string; url: string } | null;
  leave: () => Promise<void>;
}

/**
 * A read-only window onto the app's one call session, narrowed to a single
 * room. It never opens a call: joining is the room controller's business, so
 * that a skin swap re-reading this state cannot start or drop anything.
 */
export function useCallController(roomId: string): CallController {
  const session = useCallSession();
  const active = session.roomId === roomId;
  const { leave } = session;

  return useMemo(
    () => ({
      connecting: active && session.connecting,
      error: active ? session.error : null,
      connection: active ? session.connection : null,
      leave: async () => leave(),
    }),
    [active, session.connecting, session.error, session.connection, leave],
  );
}

/**
 * The box the call is drawn in, and nothing else — the LiveKit session itself
 * lives in `CallSessionProvider`, above every skin. It has no look of its own:
 * `className` is here so the skin that renders it can style its own container,
 * which is the only styling anyone is allowed to do.
 */
export function CallRoot({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={className}>{children}</div>;
}

export type CallStage = TrackReferenceOrPlaceholder[];

/**
 * Camera and screen-share tracks to draw. Screen shares are not placeholdered:
 * one that ends should leave the grid instead of holding an empty tile.
 */
export function useCallStage(): CallStage {
  return useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
}

export interface CallControls {
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
}

/**
 * Mic/camera state as plain booleans and functions, so a skin can draw its own
 * buttons instead of inheriting LiveKit's. Must be called inside `CallRoot`.
 */
export function useCallControls(): CallControls {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  return {
    micOn: isMicrophoneEnabled,
    camOn: isCameraEnabled,
    toggleMic: () => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
    toggleCam: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
  };
}

/** The bare `<video>` element for a track, and the test that one is present. */
export { VideoTrack, isTrackReference };

/** Live subtitles for the current call; must be called inside `CallRoot`. */
export function useCaptionFeed(): { lines: CaptionLine[]; interim: CaptionLine[] } {
  const { lines, interim } = useCaptions();
  return { lines, interim: Object.values(interim) };
}
