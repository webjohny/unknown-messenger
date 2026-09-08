import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

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
  type CallControls,
} from '@/core';

import { IconBack, IconCam, IconChevron, IconMic } from './icons';
import css from './breeze.module.css';

type StageTrack = ReturnType<typeof useCallStage>[number];

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
      <div className={css.toolbar}>
        <MicCamButtons controls={controls} />
      </div>

      {/* Clicking a tile blows the call up over the chat, Telegram-style: a
          one-to-one talk gets the other person full-screen with my own feed
          as a draggable window over it; three or more get a grid to tap into. */}
      {expanded && (
        <CallOverlay className={css.expanded} onClose={collapse}>
          <ExpandedCall tracks={tracks} controls={controls} onCollapse={collapse} />
          {/* Субтитри поки вимкнені: <Subtitles /> */}
        </CallOverlay>
      )}
    </>
  );
}

function MicCamButtons({ controls }: { controls: CallControls }) {
  return (
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
}

/**
 * The fullscreen call. Two people (me and whoever I'm talking to) get the
 * phone-call treatment: they fill the screen, my own feed is a little window
 * I can drag out of the way. Three or more get a grid; tapping a tile opens
 * that person full-screen with a way back. The toolbar sits on a bottom tab
 * that tucks it under the edge of the screen so it never covers a face.
 */
function ExpandedCall({
  tracks,
  controls,
  onCollapse,
}: {
  tracks: StageTrack[];
  controls: CallControls;
  onCollapse: () => void;
}) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);

  const participantCount = useMemo(
    () => new Set(tracks.map((track) => track.participant.identity)).size,
    [tracks],
  );
  const focusedTrack = tracks.find((track) => track.participant.identity === focusedId) ?? null;

  return (
    <>
      {participantCount <= 2 ? (
        <OneToOne tracks={tracks} />
      ) : focusedTrack ? (
        <Focused track={focusedTrack} onBack={() => setFocusedId(null)} />
      ) : (
        <Grid tracks={tracks} onSelect={setFocusedId} />
      )}

      <button
        type="button"
        className={css.toolbarToggle}
        onClick={() => setToolbarOpen((open) => !open)}
        aria-label={toolbarOpen ? 'Сховати панель керування' : 'Показати панель керування'}
      >
        <IconChevron direction={toolbarOpen ? 'down' : 'up'} />
      </button>
      <div className={`${css.expandedBar} ${toolbarOpen ? '' : css.expandedBarHidden}`}>
        <MicCamButtons controls={controls} />
        <button type="button" className={css.tool} onClick={onCollapse}>
          Згорнути
        </button>
      </div>
    </>
  );
}

/**
 * The other person fills the screen; my own feed floats over it, draggable.
 * Either one is clickable to swap places — a tap toggles who's big, since with
 * only two feeds "make the one I tapped big" and "swap the two" are the same
 * thing.
 */
function OneToOne({ tracks }: { tracks: StageTrack[] }) {
  const local = tracks.find((track) => track.participant.isLocal) ?? null;
  const remote = tracks.find((track) => !track.participant.isLocal) ?? null;
  const canSwap = Boolean(local && remote && local !== remote);
  const [swapped, setSwapped] = useState(false);

  const main = canSwap && swapped ? local : (remote ?? local);
  const pip = canSwap ? (swapped ? remote : local) : null;
  const toggle = () => setSwapped((value) => !value);

  return (
    <>
      {main && (
        <div
          className={canSwap ? `${css.mainVideo} ${css.mainVideoClickable}` : css.mainVideo}
          {...(canSwap
            ? {
                role: 'button',
                tabIndex: 0,
                onClick: toggle,
                onKeyDown: (event: KeyboardEvent) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggle();
                },
              }
            : {})}
        >
          {isTrackReference(main) && <VideoTrack trackRef={main} />}
          <span className={css.tileName}>{main.participant.name || main.participant.identity}</span>
        </div>
      )}
      {pip && <Pip track={pip} onSwap={toggle} />}
    </>
  );
}

/**
 * A small window over the main feed — grabbed and moved anywhere on screen,
 * or tapped (without moving it) to swap back to the main feed.
 */
function Pip({ track, onSwap }: { track: StageTrack; onSwap: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const state = drag.current;
    if (!el || !state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    // A few pixels of jitter is still a tap — only real movement cancels it.
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) state.moved = true;
    const maxX = Math.max(8, window.innerWidth - el.offsetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - el.offsetHeight - 8);
    setPos({
      x: Math.min(Math.max(8, state.originX + dx), maxX),
      y: Math.min(Math.max(8, state.originY + dy), maxY),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (state?.pointerId === event.pointerId && !state.moved) onSwap();
  };

  return (
    <div
      ref={ref}
      className={css.pip}
      role="button"
      tabIndex={0}
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSwap();
      }}
    >
      {isTrackReference(track) && <VideoTrack trackRef={track} />}
    </div>
  );
}

/** Everyone at once; tapping a tile opens that person full-screen. */
function Grid({ tracks, onSelect }: { tracks: StageTrack[]; onSelect: (id: string) => void }) {
  return (
    <div className={css.groupGrid}>
      {tracks.map((track, index) => (
        <div
          key={track.participant.identity + index}
          className={css.groupTile}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(track.participant.identity)}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onSelect(track.participant.identity);
          }}
        >
          {isTrackReference(track) && <VideoTrack trackRef={track} />}
          <span className={css.tileName}>{track.participant.name || track.participant.identity}</span>
        </div>
      ))}
    </div>
  );
}

/** One participant full-screen, with a way back to the grid. */
function Focused({ track, onBack }: { track: StageTrack; onBack: () => void }) {
  return (
    <div className={css.mainVideo}>
      {isTrackReference(track) && <VideoTrack trackRef={track} />}
      <span className={css.tileName}>{track.participant.name || track.participant.identity}</span>
      <button type="button" className={css.backBtn} onClick={onBack}>
        <IconBack />
        Назад
      </button>
    </div>
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
