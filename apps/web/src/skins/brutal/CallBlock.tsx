'use client';

import {
  CallOverlay,
  CallRoot,
  VideoTrack,
  isTrackReference,
  useCallController,
  useCallControls,
  useCallExpansion,
  useCallStage,
  useCaptionFeed,
} from '@/core';

import { IconCam, IconMic } from './icons';
import css from './brutal.module.css';

export function CallBlock({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <div className={css.note}>Dialling…</div>;
  if (call.error) return <div className={css.error}>Call failed: {call.error}</div>;
  if (!call.connection) return null;

  return (
    <CallRoot
      connection={call.connection}
      className={css.call}
      onDisconnected={() => {
        void call.leave();
        onEnd();
      }}
    >
      <Grid />
      {/* Субтитри поки вимкнені: <Subtitles /> */}
    </CallRoot>
  );
}

function Grid() {
  const tracks = useCallStage();
  const controls = useCallControls();
  const { expanded, collapse, tileProps } = useCallExpansion();

  const buttons = (
    <>
      <button type="button" className={css.callButton} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        Mic {controls.micOn ? 'ON' : 'OFF'}
      </button>
      <button type="button" className={css.callButton} onClick={controls.toggleCam}>
        <IconCam on={controls.camOn} />
        Cam {controls.camOn ? 'ON' : 'OFF'}
      </button>
    </>
  );

  return (
    <>
      <div className={css.tiles}>
        {tracks.map((track, index) => (
          <div key={track.participant.identity + index} className={css.tile} {...tileProps}>
            {isTrackReference(track) && <VideoTrack trackRef={track} />}
            <span className={css.tileName}>
              {track.participant.name || track.participant.identity}
            </span>
          </div>
        ))}
      </div>

      <div className={css.callBar}>{buttons}</div>

      {/* Clicking a tile blows the call up over the chat: the feeds stack down
          the screen and the controls sit on the seam between them. */}
      {expanded && (
        <CallOverlay className={css.expanded} onClose={collapse}>
          <div className={css.expandedStack}>
            {tracks.map((track, index) => (
              <div key={track.participant.identity + index} className={css.expandedTile}>
                {isTrackReference(track) && <VideoTrack trackRef={track} />}
                <span className={css.tileName}>
                  {track.participant.name || track.participant.identity}
                </span>
              </div>
            ))}
          </div>
          <div className={css.expandedBar}>
            {buttons}
            <button type="button" className={css.callButton} onClick={collapse}>
              Close
            </button>
          </div>
        </CallOverlay>
      )}
    </>
  );
}

// Поки не рендериться — див. закоментований <Subtitles /> вище.
function Subtitles() {
  const { lines, interim } = useCaptionFeed();
  const recent = lines.slice(-2);

  if (recent.length === 0 && interim.length === 0) return null;

  return (
    <div className={css.captions}>
      {recent.map((line) => (
        <p key={line.key} style={{ margin: 0 }}>
          <span className={css.captionsWho}>{line.participantName}</span>
          {line.text}
        </p>
      ))}
      {interim.map((line) => (
        <p key={line.key} className={css.captionsInterim} style={{ margin: 0 }}>
          <span className={css.captionsWho}>{line.participantName}</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}
