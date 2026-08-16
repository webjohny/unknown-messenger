import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import css from './chat-playback.module.css';

/** What playback needs to know about one line, and nothing more. */
export interface PlaybackCue {
  /** Characters in the line, for length-aware pacing. */
  length: number;
  /** Who to show as typing, or null for a line nobody types (a call notice). */
  author: string | null;
}

export interface PlaybackOptions {
  /** Base gap between two lines. */
  intervalMs: number;
  /** How many lines from the end to replay; everything earlier stays on screen. */
  fromLast: number;
  /** Show "X is typing…" in the gap before each line. */
  typing: boolean;
  /** Spread the gap by ±30% — an exact rhythm reads as a machine on video. */
  jitter: boolean;
  /** Let a long line take longer to "type" than a short one. */
  lengthAware: boolean;
  /** Seconds to count down before the first line. 0 turns it off. */
  countdown: number;
}

type Phase = 'idle' | 'configuring' | 'countdown' | 'playing';

export interface ChatPlayback {
  phase: Phase;
  /** True while the chat is being driven — the composer should stay out of it. */
  running: boolean;
  /** Trailing lines to keep hidden. 0 when nothing is being replayed. */
  hidden: number;
  /** Who to show as typing right now, or null. */
  typingName: string | null;
  /** How many lines are available to replay. */
  total: number;
  options: PlaybackOptions;
  setOptions: (patch: Partial<PlaybackOptions>) => void;
  /** Called by the room controller on every change to the timeline. */
  sync: (roomId: string, cues: PlaybackCue[]) => void;
  open: () => void;
  cancel: () => void;
  start: () => void;
  stop: () => void;
  countdownLeft: number;
}

const STORAGE_KEY = 'messenger.playback';

const DEFAULTS: PlaybackOptions = {
  intervalMs: 2000,
  fromLast: 5,
  typing: true,
  jitter: true,
  lengthAware: true,
  countdown: 3,
};

/** The line length that takes exactly the base interval; others scale off it. */
const REFERENCE_LENGTH = 40;

/**
 * How long the screen stays clear after the last line. Without it the panel
 * comes back the instant the take ends — into its final frame, which is the one
 * place it must never appear.
 */
const TAIL_HOLD_MS = 2500;

function loadOptions(): PlaybackOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PlaybackOptions>) } : DEFAULTS;
  } catch {
    // A corrupt or unavailable store must not cost the feature.
    return DEFAULTS;
  }
}

/** How long to wait before revealing `cue`. */
function gapBefore(cue: PlaybackCue, options: PlaybackOptions): number {
  let ms = options.intervalMs;
  if (options.lengthAware) {
    ms *= Math.min(3, Math.max(0.45, cue.length / REFERENCE_LENGTH));
  }
  if (options.jitter) {
    ms *= 0.7 + Math.random() * 0.6;
  }
  return Math.round(ms);
}

const ChatPlaybackContext = createContext<ChatPlayback | null>(null);

/**
 * Replays the tail of a conversation at a chosen pace, so it can be filmed.
 *
 * The chat is written first, normally; playback then hides the last N lines and
 * lets them back in one at a time. Because every skin renders `messages` and
 * `typing` straight from the room controller, hiding them here is all it takes
 * — the simulation works in all eleven without one of them knowing it exists.
 *
 * It lives above the skin for the same reason the call session does: changing
 * skin mid-take must not stop the take.
 */
export function ChatPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [options, setOptionsState] = useState<PlaybackOptions>(loadOptions);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [countdownLeft, setCountdownLeft] = useState(0);

  const cues = useRef<PlaybackCue[]>([]);
  const roomRef = useRef<string | null>(null);

  const setOptions = useCallback((patch: Partial<PlaybackOptions>) => {
    setOptionsState((prev) => {
      const next = { ...prev, ...patch };
      // Saved so a second take does not mean typing the same numbers again.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not worth surfacing: the settings simply will not outlive the tab.
      }
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    setPhase('idle');
    setRevealed(0);
    setTypingName(null);
    setCountdownLeft(0);
  }, []);

  const sync = useCallback(
    (roomId: string, next: PlaybackCue[]) => {
      cues.current = next;
      setTotal(next.length);
      // Walking into another room abandons the take: the lines it was counting
      // through are not on screen any more.
      if (roomRef.current !== roomId) {
        roomRef.current = roomId;
        stop();
      }
    },
    [stop],
  );

  const open = useCallback(() => setPhase('configuring'), []);
  const cancel = useCallback(() => setPhase('idle'), []);

  const start = useCallback(() => {
    const list = cues.current;
    const from = Math.max(0, list.length - Math.max(1, options.fromLast));
    setRevealed(from);
    setTypingName(null);

    if (options.countdown > 0) {
      setCountdownLeft(options.countdown);
      setPhase('countdown');
    } else {
      setPhase('playing');
    }
  }, [options.fromLast, options.countdown]);

  // The countdown: one tick a second, then straight into the first gap.
  useEffect(() => {
    if (phase !== 'countdown') return;

    const timer = setTimeout(() => {
      setCountdownLeft((left) => {
        if (left <= 1) {
          setPhase('playing');
          return 0;
        }
        return left - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdownLeft]);

  // The engine. Each pass schedules exactly one line, then re-runs on `revealed`.
  useEffect(() => {
    if (phase !== 'playing') return;

    const list = cues.current;
    if (revealed >= list.length) {
      // Everything is on screen; hold it there before handing the screen back.
      const done = setTimeout(stop, TAIL_HOLD_MS);
      return () => clearTimeout(done);
    }

    const cue = list[revealed];
    const gap = gapBefore(cue, options);
    // A beat of silence before the typing starts, or the indicator is on screen
    // the whole time and stops reading as somebody thinking.
    const typingAt = Math.round(gap * 0.25);

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (options.typing && cue.author) {
      timers.push(setTimeout(() => setTypingName(cue.author), typingAt));
    }
    timers.push(
      setTimeout(() => {
        setTypingName(null);
        setRevealed((n) => n + 1);
      }, gap),
    );

    return () => timers.forEach(clearTimeout);
  }, [phase, revealed, options, stop]);

  // Escape is the only way out mid-take, and deliberately the only one: a
  // visible stop button would be a visible stop button.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown') return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, stop]);

  const running = phase === 'playing' || phase === 'countdown';

  const value = useMemo<ChatPlayback>(
    () => ({
      phase,
      running,
      hidden: running ? Math.max(0, total - revealed) : 0,
      typingName,
      total,
      options,
      setOptions,
      sync,
      open,
      cancel,
      start,
      stop,
      countdownLeft,
    }),
    [
      phase,
      running,
      total,
      revealed,
      typingName,
      options,
      setOptions,
      sync,
      open,
      cancel,
      start,
      stop,
      countdownLeft,
    ],
  );

  return <ChatPlaybackContext.Provider value={value}>{children}</ChatPlaybackContext.Provider>;
}

export function useChatPlayback(): ChatPlayback {
  const ctx = useContext(ChatPlaybackContext);
  if (!ctx) throw new Error('useChatPlayback must be used inside <ChatPlaybackProvider>');
  return ctx;
}

/**
 * The director's panel. Rendered only where there is a conversation to replay,
 * and never while one is being replayed — whatever is on screen during a take
 * ends up in the video.
 */
export function ChatPlaybackPanel() {
  const playback = useChatPlayback();
  const { phase, options, setOptions, total, countdownLeft } = playback;

  if (typeof document === 'undefined') return null;

  if (phase === 'countdown') {
    return createPortal(<div className={css.countdown}>{countdownLeft}</div>, document.body);
  }

  if (phase === 'playing') return null;

  if (phase === 'idle') {
    return createPortal(
      <button
        type="button"
        className={css.launcher}
        onClick={playback.open}
        title="Програти чат для запису"
      >
        ▶ Програти чат
      </button>,
      document.body,
    );
  }

  const replayable = Math.min(options.fromLast, total);

  return createPortal(
    <div
      className={css.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) playback.cancel();
      }}
    >
      <div className={css.panel} role="dialog" aria-modal="true" aria-label="Симуляція чату">
        <p className={css.title}>Симуляція чату</p>
        <p className={css.subtitle}>
          Останні повідомлення сховаються і зʼявлятимуться по одному. Esc — зупинити.
        </p>

        {total === 0 && <p className={css.error}>У цій розмові ще нема чого програвати.</p>}

        <div className={css.field}>
          <span className={css.fieldLabel}>
            Інтервал
            <span className={css.hint}>секунд між повідомленнями</span>
          </span>
          <input
            className={css.number}
            type="number"
            min={0.2}
            max={60}
            step={0.1}
            value={options.intervalMs / 1000}
            onChange={(event) =>
              setOptions({ intervalMs: Math.round(Number(event.target.value) * 1000) })
            }
          />
        </div>

        <div className={css.field}>
          <span className={css.fieldLabel}>
            Скільки програвати
            <span className={css.hint}>
              повідомлень з кінця{total > 0 && ` · всього ${total}`}
            </span>
          </span>
          <input
            className={css.number}
            type="number"
            min={1}
            max={Math.max(1, total)}
            step={1}
            value={options.fromLast}
            onChange={(event) => setOptions({ fromLast: Math.max(1, Number(event.target.value)) })}
          />
        </div>

        <div className={css.field}>
          <span className={css.fieldLabel}>
            Відлік
            <span className={css.hint}>секунд перед стартом, 0 — без нього</span>
          </span>
          <input
            className={css.number}
            type="number"
            min={0}
            max={10}
            step={1}
            value={options.countdown}
            onChange={(event) =>
              setOptions({ countdown: Math.max(0, Math.min(10, Number(event.target.value))) })
            }
          />
        </div>

        <div className={css.toggles}>
          <label className={css.toggle}>
            <input
              type="checkbox"
              checked={options.typing}
              onChange={(event) => setOptions({ typing: event.target.checked })}
            />
            <span className={css.fieldLabel}>
              Індикатор набору
              <span className={css.hint}>«X пише…» у паузі перед повідомленням</span>
            </span>
          </label>

          <label className={css.toggle}>
            <input
              type="checkbox"
              checked={options.jitter}
              onChange={(event) => setOptions({ jitter: event.target.checked })}
            />
            <span className={css.fieldLabel}>
              Розкид інтервалу
              <span className={css.hint}>±30%, щоб ритм не читався як робот</span>
            </span>
          </label>

          <label className={css.toggle}>
            <input
              type="checkbox"
              checked={options.lengthAware}
              onChange={(event) => setOptions({ lengthAware: event.target.checked })}
            />
            <span className={css.fieldLabel}>
              Пауза за довжиною
              <span className={css.hint}>довге повідомлення «набирається» довше</span>
            </span>
          </label>
        </div>

        <div className={css.actions}>
          <button type="button" className={css.button} onClick={playback.cancel}>
            Скасувати
          </button>
          <button
            type="button"
            className={`${css.button} ${css.buttonPrimary}`}
            disabled={total === 0}
            onClick={playback.start}
          >
            Програти {replayable > 0 ? `(${replayable})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
