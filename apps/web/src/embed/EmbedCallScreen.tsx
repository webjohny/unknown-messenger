import { LiveKitRoom, RoomAudioRenderer, useSpeakingParticipants } from '@livekit/components-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { isTrackReference, useCallControls, useCallStage, VideoTrack, type CallStage } from '@/core';
import { adoptSession } from '@/core/useInviteController';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { JoinRoomResponse } from '@/lib/types';

import css from './EmbedCallScreen.module.css';

type Status = 'joining' | 'live' | 'failed';
type Mode = 'compact' | 'expanded';
type StageTrack = CallStage[number];

/**
 * The whole point of `/embed/:token`: a call, and nothing else, safe to put
 * inside another site's `<iframe>` (see the `/embed/` CSP location in
 * nginx.conf). Deliberately not a skin — a skin owns a whole chat app's worth
 * of screen and state; this owns one `<LiveKitRoom>` of its own, so it never
 * touches the app-wide `CallSessionProvider` that `App.tsx` ties to the chat
 * room URL.
 */
export function EmbedCallScreen({ token }: { token: string }) {
  const [searchParams] = useSearchParams();
  const assertion = searchParams.get('assertion') ?? undefined;
  const { setSession, setUser } = useAuthStore();

  const [status, setStatus] = useState<Status>('joining');
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<JoinRoomResponse | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  // StrictMode double-invokes effects in dev; a second accept would mint a
  // second guest for the same visitor.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const session = await api.acceptInvite(token, assertion);
        if (session.tokens) await adoptSession(session.tokens, setSession, setUser);
        setRoomId(session.roomId);

        const joined = await api.joinCall({
          roomId: session.roomId,
          viewerOnly: false,
          // The transcription bot is a chat-app feature; nothing here reads captions.
          enableTranscription: false,
        });
        setConnection(joined);
        setStatus('live');
      } catch (err) {
        setError(readableError((err as Error).message));
        setStatus('failed');
      }
    })();
  }, [token, assertion, setSession, setUser]);

  if (status === 'failed') {
    return (
      <div className={css.root}>
        <p className={css.message}>{error}</p>
      </div>
    );
  }

  if (status === 'joining' || !connection || !roomId) {
    return (
      <div className={css.root}>
        <p className={css.message}>Підключення…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={connection.token}
      serverUrl={connection.url}
      connect
      audio
      video
      className={css.root}
      onDisconnected={() => void api.endCall(connection.roomName).catch(() => undefined)}
    >
      <CallStageView roomId={roomId} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

/**
 * Owns the compact/expanded split. The embedding page is a different origin
 * and cannot see any of this state, so every mode change is also mirrored
 * out via `postMessage` — that is what tells the outer widget how big to
 * draw its container. The iframe itself never resizes on its own.
 */
function CallStageView({ roomId }: { roomId: string }) {
  const stage = useCallStage();
  const controls = useCallControls();
  const speakers = useSpeakingParticipants();
  const chat = useChatSocket(roomId, []);

  const [mode, setMode] = useState<Mode>('compact');
  const [showThumbs, setShowThumbs] = useState(true);
  const [showChat, setShowChat] = useState(true);

  // The embedding page is a different origin and cannot see any of this
  // state directly — this is what lets it size its container to match,
  // including shrinking when a section here collapses.
  useEffect(() => {
    window.parent.postMessage(
      { source: 'cashcome-video-call', mode, showThumbs, showChat },
      '*',
    );
  }, [mode, showThumbs, showChat]);

  // Whoever is talking right now, Meet/Zoom-style; falls back to a remote
  // participant (more interesting than staring at yourself) and finally to
  // whatever is on stage at all.
  const mainTrack = useMemo<StageTrack | null>(() => {
    if (stage.length === 0) return null;
    const speakerId = speakers[0]?.identity;
    const speaking = speakerId
      ? stage.find((t) => t.participant.identity === speakerId)
      : undefined;
    return speaking ?? stage.find((t) => !t.participant.isLocal) ?? stage[0];
  }, [stage, speakers]);

  if (mode === 'expanded') {
    return (
      <ExpandedStage
        mainTrack={mainTrack}
        stage={stage}
        controls={controls}
        showThumbs={showThumbs}
        setShowThumbs={setShowThumbs}
        showChat={showChat}
        setShowChat={setShowChat}
        chat={chat}
        onCollapse={() => setMode('compact')}
      />
    );
  }

  return (
    <CompactStage mainTrack={mainTrack} controls={controls} onExpand={() => setMode('expanded')} />
  );
}

/** Shown in place of the video whenever a tile has no live camera track. */
function CameraOffIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      className={css.camOffIcon}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MainTile({ track }: { track: StageTrack | null }) {
  const hasVideo = track && isTrackReference(track);
  return (
    <div className={css.mainTile}>
      {hasVideo && <VideoTrack trackRef={track} className={css.video} />}
      {track && !hasVideo && <CameraOffIcon size={32} />}
      {track ? (
        <span className={css.tileName}>{track.participant.name || track.participant.identity}</span>
      ) : (
        <span className={css.message}>Немає учасників</span>
      )}
    </div>
  );
}

function ControlBar({
  controls,
  extra,
}: {
  controls: ReturnType<typeof useCallControls>;
  extra?: React.ReactNode;
}) {
  const { micOn, camOn, toggleMic, toggleCam } = controls;

  return (
    <div className={css.bar}>
      <button
        type="button"
        className={micOn ? css.toolOn : css.toolOff}
        onClick={toggleMic}
        aria-label={micOn ? 'Вимкнути мікрофон' : 'Увімкнути мікрофон'}
      >
        {micOn ? '🎤' : '🔇'}
      </button>
      <button
        type="button"
        className={camOn ? css.toolOn : css.toolOff}
        onClick={toggleCam}
        aria-label={camOn ? 'Вимкнути камеру' : 'Увімкнути камеру'}
      >
        {camOn ? '🎥' : '📷'}
      </button>
      {extra}
    </div>
  );
}

function CompactStage({
  mainTrack,
  controls,
  onExpand,
}: {
  mainTrack: StageTrack | null;
  controls: ReturnType<typeof useCallControls>;
  onExpand: () => void;
}) {
  return (
    <div className={css.compact}>
      <MainTile track={mainTrack} />
      <button type="button" className={css.expandBtn} onClick={onExpand}>
        Розгорнути
      </button>
      {/* Always the last, fixed element — reachable no matter what else is on screen. */}
      <ControlBar controls={controls} />
    </div>
  );
}

function ExpandedStage({
  mainTrack,
  stage,
  controls,
  showThumbs,
  setShowThumbs,
  showChat,
  setShowChat,
  chat,
  onCollapse,
}: {
  mainTrack: StageTrack | null;
  stage: CallStage;
  controls: ReturnType<typeof useCallControls>;
  showThumbs: boolean;
  setShowThumbs: (fn: (v: boolean) => boolean) => void;
  showChat: boolean;
  setShowChat: (fn: (v: boolean) => boolean) => void;
  chat: ReturnType<typeof useChatSocket>;
  onCollapse: () => void;
}) {
  return (
    <div className={css.expanded}>
      <button type="button" className={css.collapseBtn} onClick={onCollapse} aria-label="Згорнути">
        ⌄
      </button>

      <MainTile track={mainTrack} />

      <div className={css.thumbHeader}>
        <span>Учасники ({stage.length})</span>
        <button type="button" className={css.linkBtn} onClick={() => setShowThumbs((v) => !v)}>
          {showThumbs ? 'Сховати' : 'Показати'}
        </button>
      </div>
      {showThumbs && (
        <div className={css.thumbRow}>
          {stage.map((track) => (
            <div key={`${track.participant.identity}-${track.source}`} className={css.thumb}>
              {isTrackReference(track) ? (
                <VideoTrack trackRef={track} className={css.video} />
              ) : (
                <CameraOffIcon size={20} />
              )}
              <span className={css.thumbName}>
                {track.participant.name || track.participant.identity}
              </span>
            </div>
          ))}
        </div>
      )}

      {showChat && <ChatPanel chat={chat} />}

      <ControlBar
        controls={controls}
        extra={
          <button
            type="button"
            className={showChat ? css.toolOn : css.toolOff}
            onClick={() => setShowChat((v) => !v)}
            aria-label={showChat ? 'Сховати чат' : 'Показати чат'}
          >
            💬
          </button>
        }
      />
    </div>
  );
}

function ChatPanel({ chat }: { chat: ReturnType<typeof useChatSocket> }) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => chat.messages.filter((m) => !chat.deletedIds.has(m.id)),
    [chat.messages, chat.deletedIds],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [visible.length]);

  const send = () => {
    if (!draft.trim()) return;
    chat.sendMessage(draft);
    setDraft('');
  };

  return (
    <div className={css.chat}>
      <div className={css.chatMessages}>
        {visible.map((m) => (
          <div key={m.id} className={css.chatMessage}>
            <span className={css.chatAuthor}>{m.sender?.displayName ?? m.sender?.username}:</span>{' '}
            <span>{m.body}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className={css.chatInputRow}>
        <input
          className={css.chatInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Повідомлення…"
        />
        <button type="button" className={css.chatSend} onClick={send} aria-label="Надіслати">
          ➤
        </button>
      </div>
    </div>
  );
}

function readableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON — fall through */
  }
  return raw || 'Не вдалося приєднатися до дзвінка';
}
