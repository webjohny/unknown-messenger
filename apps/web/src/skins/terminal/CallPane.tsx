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

import { GLYPH } from './glyphs';
import css from './terminal.module.css';

export function CallPane({ roomId }: { roomId: string }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.system}>* opening audio/video link…</p>;
  if (call.error) return <p className={css.error}>! call failed: {call.error}</p>;
  if (!call.connection) return null;

  return (
    <CallRoot className={css.call}>
      <Tiles />
      {/* Субтитри поки вимкнені: <Subtitles /> */}
    </CallRoot>
  );
}

function Tiles() {
  const tracks = useCallStage();
  const controls = useCallControls();
  const { expanded, collapse, tileProps } = useCallExpansion();

  const buttons = (
    <>
      <button type="button" className={css.key} onClick={controls.toggleMic}>
        {GLYPH.call} MIC {controls.micOn ? 'ON' : 'OFF'}
      </button>
      <button type="button" className={css.key} onClick={controls.toggleCam}>
        {GLYPH.camera} CAM {controls.camOn ? 'ON' : 'OFF'}
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

      <div className={css.callBar}>
        {buttons}
        <span className={css.keyFill} />
      </div>

      {/* Clicking a tile blows the call up over the chat: the feeds stack down
          the screen and the keys sit on the seam between them. */}
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
            <button type="button" className={css.key} onClick={collapse}>
              ESC CLOSE
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

  return (
    <>
      {recent.map((line) => (
        <p key={line.key} className={css.captionLine}>
          {GLYPH.caption} {line.participantName}: {line.text}
        </p>
      ))}
      {interim.map((line) => (
        <p key={line.key} className={`${css.captionLine} ${css.captionInterim}`}>
          {GLYPH.caption} {line.participantName}: {line.text}
        </p>
      ))}
    </>
  );
}
