'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  CallOverlay,
  CallRoot,
  VideoTrack,
  initials,
  isTrackReference,
  useAuthController,
  useCallController,
  useCallControls,
  useCallExpansion,
  useCallStage,
  useCaptionFeed,
  useChatListController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import {
  IconBack,
  IconCall,
  IconCam,
  IconChannel,
  IconHangUp,
  IconLink,
  IconLogout,
  IconMic,
  IconSearch,
  IconSend,
  IconSkin,
} from './icons';
import css from './hud.module.css';

export const hudManifest: SkinManifest = {
  id: 'hud',
  label: 'Cyberpunk HUD',
  description: 'Тактичний оверлей: зрізані кути, ціан і помаранч, телеметрія',
  scheme: 'dark',
  preview: ['#4fe3ff', '#04070f', '#ff8a2b'],
};

/**
 * HUD's architecture: a telemetry strip pinned to the top, a contact rail, and
 * a channel surface whose panels are cut at the corners. Incoming traffic is
 * orange, own traffic is cyan — the two are never the same shape either.
 */
export function HudSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <div className={css.scan} />
      <Telemetry />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div className={`${css.grid} ${view.name === 'room' ? css.gridRoom : css.gridList}`}>
          <Rail activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          {view.name === 'room' ? (
            <Channel roomId={view.roomId} />
          ) : (
            <section className={css.main}>
              <div className={css.empty}>no channel selected</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Telemetry() {
  const { user, signedIn, logout } = useSessionController();

  return (
    <header className={css.telemetry}>
      <span className={css.callsign}>UNKNOWN</span>
      <span className={css.reading}>LINK 03</span>
      <span className={css.reading}>ENC AES-256</span>
      <span className={css.spacer} />
      {user && <span className={css.reading}>OP: {user.username}</span>}
      <SkinPicker />
      {signedIn && (
        <button
          type="button"
          className={`${css.ghostButton} ${css.ghostButtonWarn}`}
          onClick={logout}
        >
          <IconLogout />
          Disconnect
        </button>
      )}
    </header>
  );
}

function SkinPicker() {
  const { skinId, skins, apply } = useSkinEngine();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const current = skins.find((skin) => skin.id === skinId);

  return (
    <div ref={holder} className={css.skinHolder}>
      <button
        type="button"
        className={css.ghostButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconSkin />
        SKIN: {current?.label} ▾
      </button>

      {open && (
        <div className={css.skinMenu} role="listbox">
          {skins.map((skin) => (
            <button
              key={skin.id}
              type="button"
              role="option"
              aria-selected={skin.id === skinId}
              className={`${css.skinOption} ${skin.id === skinId ? css.skinOptionActive : ''}`}
              onClick={() => {
                apply(skin.id);
                setOpen(false);
              }}
            >
              <span className={css.swatch}>
                {skin.preview.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span>{skin.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Rail({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <aside className={css.rail}>
      <div className={css.railHead}>
        <IconChannel />
        Channels · {list.chats.length}
      </div>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="query…"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={`${css.ghostButton} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'cutting link…' : 'Anon link'}
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.list}>
        {list.loadingChats && <p className={css.note}>scanning…</p>}
        {!list.loadingChats && list.chats.length === 0 && <p className={css.note}>no channels</p>}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
          >
            <span className={css.tag}>{initials(chat.name)}</span>
            <span className={css.rowText}>
              <span className={css.rowName}>{chat.name}</span>
              <span className={css.rowMeta}>{chat.subtitle}</span>
            </span>
          </Link>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>Operators</p>
            {list.loadingPeople && <p className={css.note}>querying…</p>}
            {!list.loadingPeople && list.people.length === 0 && <p className={css.note}>no match</p>}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.row}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={`${css.tag} ${css.tagWarn}`}>{initials(person.name)}</span>
                <span className={css.rowText}>
                  <span className={css.rowName}>{person.name}</span>
                  <span className={css.rowMeta}>{person.subtitle}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>channel open failed</p>}
      </div>
    </aside>
  );
}

function Channel({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={css.main}>
      <div className={css.channelHead}>
        <span className={css.tag}>{initials(room.title)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.channelName}>{room.title}</span>
          <span className={css.rowMeta}>
            {room.peer ? `@${room.peer.username}` : 'group'} ·{' '}
            {room.connected ? 'link stable' : 'link lost'}
          </span>
        </span>
        <button
          type="button"
          className={`${css.ghostButton} ${room.inCall ? css.ghostButtonWarn : ''}`}
          onClick={room.toggleCall}
        >
          {room.inCall ? <IconHangUp /> : <IconCall />}
          <span className={css.ghostLabel}>{room.inCall ? 'Terminate' : 'Open video'}</span>
        </button>
        <button type="button" className={css.ghostButton} onClick={room.leave}>
          <IconBack />
          <span className={css.ghostLabel}>Back</span>
        </button>
      </div>

      {room.inCall && <Call roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        <div className={css.divider}>
          <span className={css.dividerLine} />
          handshake complete
          <span className={css.dividerLine} />
        </div>

        {room.loadingHistory && <p className={css.note}>replaying buffer…</p>}

        {room.messages.map((message) =>
          message.call ? (
            <div key={message.id} className={css.callNotice}>
              <strong className={css.callNoticeText}>
                {message.call.kind === 'started' ? <IconCall /> : <IconHangUp />}
                {message.call.text}
                {message.call.duration && ` · ${message.call.duration}`}
              </strong>
              {message.call.hint && <span>{message.call.hint}</span>}
              {message.call.live && !room.inCall && (
                <button type="button" className={css.ghostButton} onClick={room.joinCall}>
                  <IconCall />
                  Join
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <div className={css.msgWho}>
                {message.sender.username} · {message.time}
              </div>
              <div className={css.msgBody}>{message.body}</div>
            </div>
          ),
        )}

        <div ref={room.bottomRef} />
      </div>

      <div className={css.commandBar}>
        <div className={css.status}>
          <span>{room.connected ? 'uplink ok' : 'uplink down'}</span>
          <span>{room.typing.length > 0 ? `${room.typing.join(', ')} transmitting…` : 'idle'}</span>
        </div>

        <form
          className={css.composer}
          onSubmit={(event) => {
            event.preventDefault();
            room.send();
          }}
        >
          <input
            className={css.input}
            value={room.draft}
            onChange={(event) => room.setDraft(event.target.value)}
            placeholder="transmit…"
          />
          <button type="submit" className={css.send} disabled={!room.draft.trim()}>
            <IconSend />
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function Call({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>establishing video link…</p>;
  if (call.error) return <p className={css.error}>link failed: {call.error}</p>;
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
      <button type="button" className={css.ghostButton} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        Mic {controls.micOn ? 'live' : 'muted'}
      </button>
      <button type="button" className={css.ghostButton} onClick={controls.toggleCam}>
        <IconCam on={controls.camOn} />
        Cam {controls.camOn ? 'live' : 'dark'}
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
            <button type="button" className={css.ghostButton} onClick={collapse}>
              Collapse
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
          <span className={css.captionWho}>{line.participantName}</span>
          {line.text}
        </p>
      ))}
      {interim.map((line) => (
        <p key={line.key} className={css.captionInterim} style={{ margin: 0 }}>
          <span className={css.captionWho}>{line.participantName}</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}

/**
 * The screen an invite link lands on. The controller joins and redirects on
 * its own, so all this draws is the wait and, when the link is dead, why.
 */
function InviteGate({ token }: { token: string }) {
  const join = useInviteAcceptController(token);

  return (
    <div className={css.authWrap}>
      <div className={css.authPanel}>
        <div className={css.railHead}>Invite link</div>
        <div className={css.authBody}>
          {join.status === 'joining' ? (
            <p className={css.note}>opening anon channel…</p>
          ) : (
            <>
              <p className={css.error}>{join.error}</p>
              <button type="button" className={css.send} onClick={() => location.assign('/')}>
                Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Auth() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <div className={css.authWrap}>
      <div className={css.authPanel}>
        <div className={css.railHead}>
          {auth.mode === 'login' ? 'Operator sign-in' : 'Register operator'}
        </div>

        <form
          className={css.authBody}
          onSubmit={(event) => {
            event.preventDefault();
            void auth.submit();
          }}
        >
          <div className={css.tabs}>
            {(['login', 'register'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`${css.ghostButton} ${auth.mode === mode ? '' : css.ghostButtonWarn}`}
                onClick={() => auth.setMode(mode)}
              >
                {mode === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <label className={css.field}>
            Email
            <input
              className={css.input}
              type="email"
              required
              value={auth.fields.email}
              onChange={(event) => auth.set('email', event.target.value)}
            />
          </label>

          {auth.mode === 'register' && (
            <>
              <label className={css.field}>
                Callsign
                <input
                  className={css.input}
                  required
                  minLength={3}
                  pattern="[A-Za-z0-9_.\-]+"
                  value={auth.fields.username}
                  onChange={(event) => auth.set('username', event.target.value)}
                />
              </label>
              <label className={css.field}>
                Display name
                <input
                  className={css.input}
                  required
                  value={auth.fields.displayName}
                  onChange={(event) => auth.set('displayName', event.target.value)}
                />
              </label>
            </>
          )}

          <label className={css.field}>
            Passphrase
            <input
              className={css.input}
              type="password"
              required
              minLength={8}
              value={auth.fields.password}
              onChange={(event) => auth.set('password', event.target.value)}
            />
          </label>

          {auth.error && <p className={css.error}>{auth.error}</p>}

          <button type="submit" className={css.send} disabled={auth.pending}>
            {auth.pending ? 'working…' : auth.mode === 'login' ? 'Connect' : 'Create'}
          </button>

          <div className={css.orRule}>or</div>

          {/* No account needed: this makes a room and a link to it, nothing else. */}
          <button
            type="button"
            className={`${css.ghostButton} ${css.inviteButton}`}
            onClick={() => void invite.create()}
            disabled={invite.pending}
          >
            <IconLink />
            {invite.pending ? 'cutting link…' : 'Anon channel, no signup'}
          </button>
          {invite.error && <p className={css.error}>{invite.error}</p>}
        </form>
      </div>
    </div>
  );
}
