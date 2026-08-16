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
import css from './breeze.module.css';

/** The call as a docked "video window" inside the conversation pane. */
export function CallStage({ roomId }: { roomId: string }) {
  const call = useCallController(roomId);

  if (call.connecting) return <div className={css.callStage}>Підключення до кімнати…</div>;
  if (call.error) return <div className={css.callStage}>Помилка: {call.error}</div>;
  if (!call.connection) return null;

  return (
    <CallRoot className={css.callStage}>
      <Tiles />
    </CallRoot>
  );
}

function Tiles() {
  const tracks = useCallStage();
  const controls = useCallControls();
  const { expanded, collapse, tileProps } = useCallExpansion();

  const buttons = (
    <>
      <button type="button" className={css.tool} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        {controls.micOn ? 'Мікрофон увімк.' : 'Мікрофон вимк.'}
      </button>
      <button type="button" className={css.tool} onClick={controls.toggleCam}>
        <IconCam on={controls.camOn} />
        {controls.camOn ? 'Камера увімк.' : 'Камера вимк.'}
      </button>
    </>
  );

  return (
    <>
      {/* Коли субтитри повернуть: їхнє місце — всередині сітки плиток, щоб вони
          лягали поверх відео, а не поверх панелі під ним. */}
      <div className={css.tiles}>
        {tracks.map((track, index) => (
          <div key={track.participant.identity + index} className={css.tile} {...tileProps}>
            {isTrackReference(track) && <VideoTrack trackRef={track} />}
            <span className={css.tileName}>{track.participant.name || track.participant.identity}</span>
          </div>
        ))}
        {/* Субтитри поки вимкнені: <Subtitles /> */}
      </div>
      <div className={css.toolbar}>{buttons}</div>

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
            <button type="button" className={css.tool} onClick={collapse}>
              Згорнути
            </button>
          </div>
          {/* Субтитри поки вимкнені: <Subtitles /> */}
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
          <span className={css.captionWho}>{line.participantName}:</span>
          {line.text}
        </p>
      ))}
      {interim.map((line) => (
        <p key={line.key} className={css.captionInterim} style={{ margin: 0 }}>
          <span className={css.captionWho}>{line.participantName}:</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}
