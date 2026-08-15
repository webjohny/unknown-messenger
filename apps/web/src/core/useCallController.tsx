'use client';

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

import { useCaptions, type CaptionLine } from '@/hooks/useCaptions';
import { useLivekitRoom } from '@/hooks/useLivekitRoom';

export interface CallController {
  connecting: boolean;
  error: string | null;
  /** Null until the token arrives; skins render their own placeholder. */
  connection: { token: string; url: string } | null;
  leave: () => Promise<void>;
}

export function useCallController(roomId: string): CallController {
  const { connection, loading, error, leave } = useLivekitRoom(roomId);
  return { connecting: loading, error, connection, leave };
}

/**
 * The call's plumbing: a LiveKit session plus audio playback, and nothing else.
 * It has no look of its own — `className` is here so the skin that renders it
 * can style its own container, which is the only styling anyone is allowed to do.
 */
export function CallRoot({
  connection,
  className,
  onDisconnected,
  children,
}: {
  connection: { token: string; url: string };
  className?: string;
  onDisconnected?: () => void;
  children: React.ReactNode;
}) {
  return (
    <LiveKitRoom
      token={connection.token}
      serverUrl={connection.url}
      connect
      audio
      video
      onDisconnected={onDisconnected}
      className={className}
    >
      {children}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
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
