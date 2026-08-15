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
  useIdentityController,
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
  IconFriends,
  IconHangUp,
  IconHeart,
  IconLink,
  IconLogout,
  IconMic,
  IconSearch,
  IconSend,
} from './icons';
import css from './kawaii.module.css';

export const kawaiiManifest: SkinManifest = {
  id: 'kawaii',
  label: 'Kawaii',
  description: 'Sanrio-настрій: пастель, стікери, лавандові бульбашки',
  scheme: 'light',
  preview: ['#ff7fc4', '#ffe6f6', '#c8b6ff'],
};

/**
 * Kawaii's architecture: a soft bar on top and two pillow-shaped panels. Every
 * corner is round, every surface has a highlight on top and a shadow lip below.
 */
export function KawaiiSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <TopBar />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div className={`${css.stage} ${view.name === 'room' ? css.stageRoom : css.stageList}`}>
          <Friends activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          {view.name === 'room' ? (
            <Chat roomId={view.roomId} />
          ) : (
            <section className={`${css.panel} ${css.main}`}>
              <div className={css.empty}>Обери, з ким побалакати (๑˘◡˘๑)</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { user, signedIn, logout } = useSessionController();

  return (
    <header className={css.topBar}>
      <span className={css.brand}>♡ Unknown</span>
      <span className={css.spacer} />
      {user && <span style={{ fontSize: 13, color: '#b0559d' }}>@{user.username}</span>}
      <SkinPicker />
      {signedIn && (
        <button
          type="button"
          className={`${css.bubbleButton} ${css.bubbleButtonSoft}`}
          onClick={logout}
        >
          <IconLogout />
          Вийти
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
        className={css.bubbleButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconHeart />
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
              {skin.id === skinId && <span>♥</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Friends({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <aside className={`${css.panel} ${css.side}`}>
      <div className={css.panelHead}>
        <IconFriends />
        friends
        <span className={css.headSpacer} />
        <button
          type="button"
          className={`${css.bubbleButton} ${css.bubbleButtonSoft} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
          title="анонімна лінка"
        >
          <IconLink />
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="кого шукаємо?"
        />
      </div>

      <div className={css.list}>
        {list.loadingChats && <p className={css.note}>завантажую…</p>}
        {!list.loadingChats && list.chats.length === 0 && (
          <p className={css.note}>тут поки порожньо ˘·˘</p>
        )}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
          >
            <span className={css.avatar}>{initials(chat.name)}</span>
            <span className={css.rowText}>
              <span className={css.rowName}>{chat.name}</span>
              <span className={css.rowMeta}>{chat.subtitle}</span>
            </span>
          </Link>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>нові знайомства</p>
            {list.loadingPeople && <p className={css.note}>шукаю…</p>}
            {!list.loadingPeople && list.people.length === 0 && (
              <p className={css.note}>нікого ˃̣̣̥᷄⌓˂̣̣̥᷅</p>
            )}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.row}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={`${css.avatar} ${css.avatarAlt}`}>{initials(person.name)}</span>
                <span className={css.rowText}>
                  <span className={css.rowName}>{person.name}</span>
                  <span className={css.rowMeta}>{person.subtitle}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>не вийшло відкрити чат</p>}
      </div>
    </aside>
  );
}

/**
 * A guest arrives as `user3737` — a number, not a name. Here they can type over
 * it, no account needed.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span>привіт,</span>
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
        {me.error ?? (me.pending ? 'зберігаю…' : me.dirty ? 'Enter — зберегти ♪' : 'можна змінити')}
      </span>
    </div>
  );
}

function Chat({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={`${css.panel} ${css.main}`}>
      <div className={css.panelHead}>
        <span className={css.avatar}>{initials(room.title)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.rowName}>{room.title}</span>
          <span className={css.rowMeta}>
            {room.connected ? 'онлайн ♪' : 'зв’язок загубився…'}
          </span>
        </span>
        <button type="button" className={css.bubbleButton} onClick={room.toggleCall}>
          {room.inCall ? <IconHangUp /> : <IconCall />}
          <span className={css.buttonLabel}>{room.inCall ? 'покласти' : 'подзвонити'}</span>
        </button>
        <button
          type="button"
          className={`${css.bubbleButton} ${css.bubbleButtonSoft}`}
          onClick={room.leave}
        >
          <IconBack />
          <span className={css.buttonLabel}>назад</span>
        </button>
      </div>

      <Greeting />

      {room.inCall && <Call roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.note}>гортаю історію…</p>}

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
                <button type="button" className={css.bubbleButton} onClick={room.joinCall}>
                  <IconCall />
                  приєднатись
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <span className={`${css.avatar} ${message.own ? css.avatarAlt : ''}`}>
                {initials(message.sender.displayName)}
              </span>
              <div>
                <div className={css.msgWho}>
                  {message.sender.displayName} · {message.time}
                </div>
                <div className={css.bubble}>{message.body}</div>
              </div>
            </div>
          ),
        )}

        <div ref={room.bottomRef} />
      </div>

      <div className={css.footer}>
        <div className={css.hint}>
          {room.typing.length > 0 ? `${room.typing.join(', ')} щось пише… ♡` : ''}
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
            placeholder="напиши щось миле…"
          />
          <button type="submit" className={css.bubbleButton} disabled={!room.draft.trim()}>
            <IconSend />
          </button>
        </form>
      </div>
    </section>
  );
}

function Call({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>дзвоню…</p>;
  if (call.error) return <p className={css.error}>ой: {call.error}</p>;
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
      <button type="button" className={css.bubbleButton} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        {controls.micOn ? 'мікрофон увімк.' : 'мікрофон вимк.'}
      </button>
      <button
        type="button"
        className={`${css.bubbleButton} ${css.bubbleButtonSoft}`}
        onClick={controls.toggleCam}
      >
        <IconCam on={controls.camOn} />
        {controls.camOn ? 'камера увімк.' : 'камера вимк.'}
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

      {/* Клік по віконцю розгортає дзвінок над чатом: екрани стовпчиком,
          кнопки — на стику між ними. */}
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
            <button
              type="button"
              className={`${css.bubbleButton} ${css.bubbleButtonSoft}`}
              onClick={collapse}
            >
              згорнути
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

/**
 * The screen an invite link lands on. The controller joins and redirects on
 * its own, so all this draws is the wait and, when the link is dead, why.
 */
function InviteGate({ token }: { token: string }) {
  const join = useInviteAcceptController(token);

  return (
    <div className={css.authWrap}>
      <div className={`${css.panel} ${css.authCard}`}>
        <span className={css.brand}>♡ Unknown</span>
        {join.status === 'joining' ? (
          <p className={css.note}>заходимо в анонімну кімнату… (๑˘◡˘๑)</p>
        ) : (
          <>
            <p className={css.error}>{join.error}</p>
            <button
              type="button"
              className={css.bubbleButton}
              onClick={() => location.assign('/')}
            >
              на головну
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Auth() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <div className={css.authWrap}>
      <form
        className={`${css.panel} ${css.authCard}`}
        onSubmit={(event) => {
          event.preventDefault();
          void auth.submit();
        }}
      >
        <span className={css.brand}>♡ Unknown</span>

        <div className={css.tabs}>
          {(['login', 'register'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${css.tab} ${auth.mode === mode ? css.tabActive : ''}`}
              onClick={() => auth.setMode(mode)}
            >
              {mode === 'login' ? 'вхід' : 'реєстрація'}
            </button>
          ))}
        </div>

        <label className={css.field}>
          пошта
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
              нікнейм
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
              ім’я
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
          пароль
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

        <button type="submit" className={css.bubbleButton} disabled={auth.pending}>
          <IconHeart />
          {auth.pending ? 'секундочку…' : auth.mode === 'login' ? 'увійти' : 'створити'}
        </button>

        <div className={css.orRule}>або</div>

        {/* No account needed: this makes a room and a link to it, nothing else. */}
        <button
          type="button"
          className={`${css.bubbleButton} ${css.bubbleButtonSoft}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'роблю лінку…' : 'анонімний чат без реєстрації'}
        </button>
        {invite.error && <p className={css.error}>{invite.error}</p>}
      </form>
    </div>
  );
}
