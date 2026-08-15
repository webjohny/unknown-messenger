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
  IconChats,
  IconHangUp,
  IconLink,
  IconLogout,
  IconMic,
  IconSearch,
  IconSend,
} from './icons';
import css from './aero.module.css';

export const aeroManifest: SkinManifest = {
  id: 'aero',
  label: 'Windows Vista',
  description: 'Aero Glass: матове скло, м’які кола, аквамарин',
  scheme: 'light',
  preview: ['#0a8fc4', '#cdf3ff', '#2acea6'],
};

/**
 * Aero's architecture: one glass bar on top, then free-floating cards. Panels
 * never touch each other — the gradient shows through every gap.
 */
export function AeroSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <GlassBar />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div
          className={`${css.stage} ${view.name === 'room' ? css.stageRoom : css.stageList}`}
        >
          <Contacts activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          {view.name === 'room' ? (
            <Conversation roomId={view.roomId} />
          ) : (
            <section className={`${css.card} ${css.mainCard}`}>
              <div className={css.empty}>Оберіть розмову ліворуч</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function GlassBar() {
  const { user, signedIn, logout } = useSessionController();

  return (
    <header className={css.glassBar}>
      <span className={css.brand}>Unknown</span>
      <span className={css.spacer} />
      {user && <span style={{ fontSize: 13 }}>@{user.username}</span>}
      <SkinPicker />
      {signedIn && (
        <button type="button" className={`${css.pill} ${css.pillGhost}`} onClick={logout}>
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
        className={css.pill}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={css.swatch}>
          {current?.preview.map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </span>
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

function Contacts({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <aside className={`${css.card} ${css.sideCard}`}>
      <div className={css.cardHead}>
        <IconChats />
        Розмови
      </div>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="Пошук…"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={css.pill}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'Створюємо…' : 'Анонімна лінка'}
        </button>
      </div>
      {invite.error && <p className={css.error}>{invite.error}</p>}

      <div className={css.list}>
        {list.loadingChats && <p className={css.note}>Завантаження…</p>}
        {!list.loadingChats && list.chats.length === 0 && (
          <p className={css.note}>Ще немає розмов</p>
        )}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
          >
            <span className={`${css.avatar} ${css.avatarOnline}`}>{initials(chat.name)}</span>
            <span className={css.rowText}>
              <span className={css.rowName}>{chat.name}</span>
              <span className={css.rowMeta}>{chat.subtitle}</span>
            </span>
          </Link>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>Люди</p>
            {list.loadingPeople && <p className={css.note}>Пошук…</p>}
            {!list.loadingPeople && list.people.length === 0 && (
              <p className={css.note}>Нікого не знайдено</p>
            )}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.row}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={css.avatar}>{initials(person.name)}</span>
                <span className={css.rowText}>
                  <span className={css.rowName}>{person.name}</span>
                  <span className={css.rowMeta}>{person.subtitle}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>Не вдалося відкрити чат</p>}
      </div>
    </aside>
  );
}

function Conversation({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={`${css.card} ${css.mainCard}`}>
      <div className={css.cardHead}>
        <span className={`${css.avatar} ${css.avatarOnline}`}>{initials(room.title)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.rowName}>{room.title}</span>
          <span className={css.rowMeta}>
            {room.peer ? `@${room.peer.username}` : 'група'} ·{' '}
            {room.connected ? 'на зв’язку' : 'офлайн'}
          </span>
        </span>
        <button type="button" className={css.pill} onClick={room.toggleCall}>
          {room.inCall ? <IconHangUp /> : <IconCall />}
          <span className={css.pillLabel}>{room.inCall ? 'Завершити' : 'Подзвонити'}</span>
        </button>
        <button type="button" className={`${css.pill} ${css.pillGhost}`} onClick={room.leave}>
          <IconBack />
          <span className={css.pillLabel}>Назад</span>
        </button>
      </div>

      {room.inCall && <Call roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.note}>Завантаження історії…</p>}

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
                <button type="button" className={css.pill} onClick={room.joinCall}>
                  <IconCall />
                  <span className={css.pillLabel}>Приєднатись</span>
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <span className={css.msgWho}>
                {message.sender.displayName} · {message.time}
              </span>
              <div className={css.bubble}>{message.body}</div>
            </div>
          ),
        )}

        <div ref={room.bottomRef} />
      </div>

      <div className={css.footer}>
        <div className={css.hint}>
          {room.typing.length > 0 ? `${room.typing.join(', ')} пише…` : ''}
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
            placeholder="Написати повідомлення…"
          />
          <button type="submit" className={css.send} disabled={!room.draft.trim()}>
            <IconSend />
            Надіслати
          </button>
        </form>
      </div>
    </section>
  );
}

function Call({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>Підключення…</p>;
  if (call.error) return <p className={css.error}>Помилка: {call.error}</p>;
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
      <button type="button" className={css.pill} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        {controls.micOn ? 'Мікрофон увімк.' : 'Мікрофон вимк.'}
      </button>
      <button type="button" className={css.pill} onClick={controls.toggleCam}>
        <IconCam on={controls.camOn} />
        {controls.camOn ? 'Камера увімк.' : 'Камера вимк.'}
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
            <button type="button" className={`${css.pill} ${css.pillGhost}`} onClick={collapse}>
              Згорнути
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
 * The screen an invite link lands on. It has nothing to ask: the controller
 * joins and redirects on its own, so all there is to draw is the wait and,
 * when the link is dead, the reason.
 */
function InviteGate({ token }: { token: string }) {
  const join = useInviteAcceptController(token);

  return (
    <div className={css.authWrap}>
      <div className={`${css.card} ${css.authCard}`}>
        <span className={css.brand}>Unknown</span>
        {join.status === 'joining' ? (
          <p className={css.note}>Заходимо в анонімну кімнату…</p>
        ) : (
          <>
            <p className={css.error}>{join.error}</p>
            <button type="button" className={css.send} onClick={() => location.assign('/')}>
              На головну
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
        className={`${css.card} ${css.authCard}`}
        onSubmit={(event) => {
          event.preventDefault();
          void auth.submit();
        }}
      >
        <span className={css.brand}>Unknown</span>

        <div className={css.tabs}>
          {(['login', 'register'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${css.tab} ${auth.mode === mode ? css.tabActive : ''}`}
              onClick={() => auth.setMode(mode)}
            >
              {mode === 'login' ? 'Вхід' : 'Реєстрація'}
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
              Нікнейм
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
              Ім’я
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
          Пароль
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
          {auth.pending ? 'Зачекайте…' : auth.mode === 'login' ? 'Увійти' : 'Створити акаунт'}
        </button>

        <div className={css.orRule}>або</div>

        {/* No account needed: this makes a room and a link to it, nothing else. */}
        <button
          type="button"
          className={`${css.pill} ${css.pillGhost} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'Створюємо…' : 'Анонімний чат без реєстрації'}
        </button>
        {invite.error && <p className={css.error}>{invite.error}</p>}
      </form>
    </div>
  );
}
