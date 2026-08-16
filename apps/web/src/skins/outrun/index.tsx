import { useEffect, useRef, useState } from 'react';

import {
  AppLink,
  CallOverlay,
  CallRoot,
  isTrackReference,
  useAuthController,
  useCallController,
  useCallControls,
  useCallExpansion,
  useCallStage,
  useCaptionFeed,
  useChatListController,
  useIdentityController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
  VideoTrack,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import {
  IconBack,
  IconCall,
  IconCam,
  IconHangUp,
  IconLink,
  IconLogout,
  IconMic,
  IconSearch,
  IconSend,
  IconSkin,
  IconStation,
} from './icons';
import css from './outrun.module.css';

export const outrunManifest: SkinManifest = {
  id: 'outrun',
  label: 'Synthwave',
  description: 'Outrun 80-х: неонова сітка, мадженто й ціан, скан-лінії',
  scheme: 'dark',
  preview: ['#ff3ec8', '#10021f', '#22e6ff'],
};

/**
 * Outrun's architecture: a perspective grid burned into the background, a
 * marquee across the top, a station strip on the left and a feed in the middle.
 * Nothing is boxed — panels are separated by glowing rules only.
 */
export function OutrunSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <div className={css.horizon} />
      <div className={css.scan} />
      <Marquee />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div className={`${css.deck} ${view.name === 'room' ? css.deckRoom : css.deckList}`}>
          <Stations activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          {view.name === 'room' ? (
            <Feed roomId={view.roomId} />
          ) : (
            <section className={css.main}>
              <div className={css.empty}>select a station</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Marquee() {
  const { user, signedIn, logout } = useSessionController();

  return (
    <header className={css.marquee}>
      <span className={css.logo}>Unknown</span>
      <span className={css.meta}>night drive fm</span>
      <span className={css.spacer} />
      {user && <span className={css.meta}>@{user.username}</span>}
      <SkinPicker />
      {signedIn && (
        <button type="button" className={`${css.neonButton} ${css.neonButtonPink}`} onClick={logout}>
          <IconLogout />
          Exit
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
        className={css.neonButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconSkin />
        {current?.label} ▾
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

function Stations({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <aside className={css.stations}>
      <div className={css.stationsHead}>
        <IconStation />
        Stations
      </div>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="tune in…"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={`${css.neonButton} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'cutting…' : 'Anon link'}
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.list}>
        {list.loadingChats && <p className={css.note}>tuning…</p>}
        {!list.loadingChats && list.chats.length === 0 && <p className={css.note}>static only</p>}

        {list.chats.map((chat) => (
          <AppLink
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
          >
            <span className={css.rowName}>{chat.name}</span>
          </AppLink>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>drivers</p>
            {list.loadingPeople && <p className={css.note}>scanning…</p>}
            {!list.loadingPeople && list.people.length === 0 && <p className={css.note}>no signal</p>}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.row}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={css.rowName}>{person.name}</span>
                <span className={css.rowMeta}>{list.opening ? '…' : 'open'}</span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>channel failed</p>}
      </div>
    </aside>
  );
}

/**
 * A guest is issued `user3737` — a serial, not a handle. This is the line that
 * lets them rewrite it, with no account behind it.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span className={css.greetingLabel}>handle</span>
      <input
        className={css.greetingInput}
        value={me.draft}
        maxLength={me.maxLength}
        disabled={me.pending}
        aria-label="Ваше ім’я в чаті"
        onChange={(event) => me.setDraft(event.target.value)}
        onBlur={me.save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') me.cancel();
        }}
      />
      <span className={me.error ? css.greetingError : css.greetingHint}>
        {me.error ?? (me.pending ? 'saving…' : me.dirty ? 'enter to save' : 'editable')}
      </span>
    </div>
  );
}

function Feed({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={css.main}>
      <div className={css.head}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.title}>{room.title}</span>
          <span className={css.rowMeta}>
            {room.connected ? ' signal locked' : ' signal lost'}
          </span>
        </span>
        <button
          type="button"
          className={`${css.neonButton} ${room.inCall ? css.neonButtonPink : ''}`}
          onClick={room.toggleCall}
        >
          {room.inCall ? <IconHangUp /> : <IconCall />}
          <span className={css.neonLabel}>{room.inCall ? 'Cut feed' : 'Go live'}</span>
        </button>
        <button type="button" className={css.neonButton} onClick={room.leave}>
          <IconBack />
          <span className={css.neonLabel}>Back</span>
        </button>
      </div>

      <Greeting />

      {room.inCall && <Call roomId={roomId} />}

      <div className={css.feed}>
        {room.loadingHistory && <p className={css.note}>rewinding tape…</p>}

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
                <button
                  type="button"
                  className={`${css.neonButton} ${css.neonButtonPink}`}
                  onClick={room.joinCall}
                >
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

      <div className={css.footer}>
        <div className={css.ticker}>
          {room.typing.length > 0 ? `${room.typing.join(', ')} on air…` : ''}
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
          <button type="submit" className={css.neonButton} disabled={!room.draft.trim()}>
            <IconSend />
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function Call({ roomId }: { roomId: string }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>opening feed…</p>;
  if (call.error) return <p className={css.error}>feed failed: {call.error}</p>;
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
      <button type="button" className={css.neonButton} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        Mic {controls.micOn ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className={`${css.neonButton} ${css.neonButtonPink}`}
        onClick={controls.toggleCam}
      >
        <IconCam on={controls.camOn} />
        Cam {controls.camOn ? 'on' : 'off'}
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
            <button type="button" className={css.neonButton} onClick={collapse}>
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
        <div className={css.stationsHead}>Invite link</div>
        <div className={css.authBody}>
          {join.status === 'joining' ? (
            <p className={css.note}>tuning into anon station…</p>
          ) : (
            <>
              <p className={css.error}>{join.error}</p>
              <button
                type="button"
                className={css.neonButton}
                onClick={() => location.assign('/')}
              >
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
        <div className={css.stationsHead}>{auth.mode === 'login' ? 'Sign in' : 'New driver'}</div>

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
                className={`${css.neonButton} ${auth.mode === mode ? css.neonButtonPink : ''}`}
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
                Handle
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
            Password
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

          <button type="submit" className={css.neonButton} disabled={auth.pending}>
            {auth.pending ? 'connecting…' : auth.mode === 'login' ? 'Drive' : 'Create'}
          </button>

          <div className={css.orRule}>or</div>

          {/* No account needed: this makes a room and a link to it, nothing else. */}
          <button
            type="button"
            className={`${css.neonButton} ${css.neonButtonPink} ${css.inviteButton}`}
            onClick={() => void invite.create()}
            disabled={invite.pending}
          >
            <IconLink />
            {invite.pending ? 'cutting link…' : 'Anon station, no signup'}
          </button>
          {invite.error && <p className={css.error}>{invite.error}</p>}
        </form>
      </div>
    </div>
  );
}
