'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  CallOverlay,
  CallRoot,
  VideoTrack,
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
  IconHangUp,
  IconLink,
  IconLogout,
  IconMic,
  IconPen,
  IconPeople,
  IconSearch,
  IconSend,
} from './icons';
import css from './scrapbook.module.css';

export const scrapbookManifest: SkinManifest = {
  id: 'scrapbook',
  label: 'Scrapbook',
  description: 'Паперові аркуші на столі, скотч і рукописний текст',
  scheme: 'light',
  preview: ['#e8b13c', '#fffdf6', '#2f4a63'],
};

/**
 * Scrapbook's architecture: sheets of paper laid on a desk. The contact list is
 * a ruled notebook page, the conversation is a big sheet, and every message is
 * its own note — each pinned at a slightly different angle.
 */
export function ScrapbookSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <Header />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div className={`${css.desk} ${view.name === 'room' ? css.deskRoom : css.deskList}`}>
          <Notebook activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          {view.name === 'room' ? (
            <Sheet roomId={view.roomId} />
          ) : (
            <section className={css.sheet}>
              <span className={css.tape} />
              <div className={css.empty}>Обери, кому написати ✎</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Header() {
  const { user, signedIn, logout } = useSessionController();

  return (
    <header className={css.header}>
      <span className={css.title}>Unknown ✂ Scrapbook</span>
      <span className={css.spacer} />
      {user && <span className={css.rowMeta}>@{user.username}</span>}
      <SkinPicker />
      {signedIn && (
        <button type="button" className={`${css.tapeButton} ${css.tapeButtonBlue}`} onClick={logout}>
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
        className={css.tapeButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconPen />
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

function Notebook({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <aside className={css.notebook}>
      <span className={css.tape} />
      <p className={css.notebookTitle}>
        <IconPeople />
        Мої люди
      </p>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="кого шукаємо?"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={`${css.tapeButton} ${css.tapeButtonBlue} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'клею лінку…' : 'Анонімна лінка'}
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.list}>
        {list.loadingChats && <p className={css.note}>гортаю сторінки…</p>}
        {!list.loadingChats && list.chats.length === 0 && <p className={css.note}>поки порожньо</p>}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
          >
            <span className={css.bullet} />
            <span className={css.rowText}>
              <span className={css.rowName}>{chat.name}</span>
              <span className={css.rowMeta}>{chat.subtitle}</span>
            </span>
          </Link>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>нові знайомі</p>
            {list.loadingPeople && <p className={css.note}>шукаю…</p>}
            {!list.loadingPeople && list.people.length === 0 && <p className={css.note}>нікого</p>}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.row}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={`${css.bullet} ${css.bulletIdle}`} />
                <span className={css.rowText}>
                  <span className={css.rowName}>{person.name}</span>
                  <span className={css.rowMeta}>{person.subtitle}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.note}>не вийшло відкрити</p>}
      </div>
    </aside>
  );
}

function Sheet({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={css.sheet}>
      <span className={css.tape} />
      <span className={`${css.tape} ${css.tapeRight}`} />

      <div className={css.sheetHead}>
        <span className={css.sheetTitle}>{room.title}</span>
        <span className={css.rowMeta}>
          {room.peer ? `@${room.peer.username}` : 'гурт'} ·{' '}
          {room.connected ? 'на зв’язку' : 'зв’язку немає'}
        </span>
        <span className={css.spacer} />
        <button type="button" className={css.tapeButton} onClick={room.toggleCall}>
          {room.inCall ? <IconHangUp /> : <IconCall />}
          {room.inCall ? 'Закінчити' : 'Подзвонити'}
        </button>
        <button
          type="button"
          className={`${css.tapeButton} ${css.tapeButtonBlue}`}
          onClick={room.leave}
        >
          <IconBack />
          Назад
        </button>
      </div>

      {room.inCall && <Call roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.notes}>
        {room.loadingHistory && <p className={css.note}>шукаю старі записки…</p>}

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
                <button type="button" className={css.tapeButton} onClick={room.joinCall}>
                  <IconCall />
                  приєднатись
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <div className={css.msgWho}>
                {message.sender.displayName}, {message.time}
              </div>
              <div className={css.msgText}>{message.body}</div>
            </div>
          ),
        )}

        <div ref={room.bottomRef} />
      </div>

      <div className={css.footer}>
        <div className={css.hint}>
          {room.typing.length > 0 ? `${room.typing.join(', ')} щось пише…` : ''}
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
            placeholder="написати записку…"
          />
          <button type="submit" className={css.tapeButton} disabled={!room.draft.trim()}>
            <IconSend />
            Приклеїти
          </button>
        </form>
      </div>
    </section>
  );
}

function Call({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>дзвоню…</p>;
  if (call.error) return <p className={css.error}>halt: {call.error}</p>;
  if (!call.connection) return null;

  return (
    <CallRoot
      connection={call.connection}
      className={css.polaroid}
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
      <button type="button" className={css.tapeButton} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        {controls.micOn ? 'мікрофон увімк.' : 'мікрофон вимк.'}
      </button>
      <button
        type="button"
        className={`${css.tapeButton} ${css.tapeButtonBlue}`}
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

      {/* Клік по знімку розкладає обидва на весь стіл, один під одним, а
          кнопки лягають на стик між ними. */}
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
            <button type="button" className={css.tapeButton} onClick={collapse}>
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
      <div className={css.authSheet}>
        <span className={css.tape} />
        <p className={css.notebookTitle} style={{ paddingLeft: 0 }}>
          Запрошення
        </p>

        {join.status === 'joining' ? (
          <p className={css.note}>заходимо в анонімну кімнату…</p>
        ) : (
          <>
            <p className={css.error}>{join.error}</p>
            <button type="button" className={css.tapeButton} onClick={() => location.assign('/')}>
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
        className={css.authSheet}
        onSubmit={(event) => {
          event.preventDefault();
          void auth.submit();
        }}
      >
        <span className={css.tape} />
        <p className={css.notebookTitle} style={{ paddingLeft: 0 }}>
          {auth.mode === 'login' ? 'Впусти мене' : 'Новий щоденник'}
        </p>

        <div className={css.tabs}>
          {(['login', 'register'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`${css.tapeButton} ${auth.mode === mode ? '' : css.tapeButtonBlue}`}
              onClick={() => auth.setMode(mode)}
            >
              {mode === 'login' ? 'Вхід' : 'Реєстрація'}
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

        <button type="submit" className={css.tapeButton} disabled={auth.pending}>
          {auth.pending ? 'хвилинку…' : auth.mode === 'login' ? 'Увійти' : 'Створити'}
        </button>

        <div className={css.orRule}>або</div>

        {/* No account needed: this makes a room and a link to it, nothing else. */}
        <button
          type="button"
          className={`${css.tapeButton} ${css.tapeButtonBlue} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          {invite.pending ? 'клею лінку…' : 'Анонімний чат без реєстрації'}
        </button>
        {invite.error && <p className={css.error}>{invite.error}</p>}
      </form>
    </div>
  );
}
