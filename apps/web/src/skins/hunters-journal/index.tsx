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
  useIdentityController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
} from '@/core';
import { useSkinEngine } from '@/skin-engine';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';

import {
  IconBack,
  IconBook,
  IconCall,
  IconCam,
  IconCar,
  IconHangUp,
  IconLink,
  IconLogout,
  IconMic,
  IconPeople,
  IconRune,
  IconSearch,
  IconSend,
  IconSigil,
  IconTrap,
} from './icons';
import css from './hunters-journal.module.css';

export const huntersJournalManifest: SkinManifest = {
  id: 'hunters-journal',
  label: "Hunter's Journal",
  description: 'Шкіряний щоденник на столі: ліва сторінка — люди, права — розмова',
  scheme: 'dark',
  preview: ['#7c1d12', '#ddceac', '#1e1106'],
};

/**
 * The journal's architecture: a desk, a leather cover, and one book open on it.
 * The spread never changes — the left page is always who is still breathing,
 * the right page is always the hunt you are on. Which of the two you get on a
 * phone is decided by the route, because a spread does not fit in 390px.
 */
export function HuntersJournalSkin({ view }: SkinProps) {
  return (
    <div className={css.desk}>
      <span className={css.lamp} />

      <div className={css.cover}>
        <span className={css.scuffA} />
        <span className={css.scuffB} />
        <span className={css.scuffBurn} />
      </div>

      <HuntPlate />

      {view.name === 'invite' ? (
        <div className={css.book}>
          <InviteGate token={view.token} />
        </div>
      ) : view.name === 'auth' ? (
        <div className={css.book}>
          <Ledger />
        </div>
      ) : (
        <div className={`${css.book} ${view.name === 'room' ? css.bookRoom : css.bookList}`}>
          <ContactsPage activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          <Spine />
          {view.name === 'room' ? <ThreadPage roomId={view.roomId} /> : <IdlePage />}
        </div>
      )}

      <Bookmarks />
      <span className={css.grime} />
    </div>
  );
}

/** The brass plate screwed to the cover. */
function HuntPlate() {
  const { user } = useSessionController();

  return (
    <div className={`${css.plate} ${css.hunt}`}>
      <span className={css.huntCar}>
        <IconCar />
      </span>
      <span className={css.huntText}>
        {user ? `ПОЛЮВАННЯ ТРИВАЄ · @${user.username}` : 'ЩОДЕННИК МИСЛИВЦЯ'}
      </span>
    </div>
  );
}

function Spine() {
  return (
    <div className={css.spine}>
      {[0, 1, 2, 3, 4].map((ring) => (
        <span key={ring} className={css.ring} />
      ))}
    </div>
  );
}

/* ── Left page ─────────────────────────────────────────────────────────── */

function ContactsPage({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();
  const search = useRef<HTMLInputElement>(null);

  return (
    <section className={`${css.page} ${css.pageLeft}`}>
      <span className={`${css.margin} ${css.marginLeft}`} />
      <span className={`${css.decor} ${css.trapSmall}`}>
        <IconTrap size={190} stroke={0.34} />
      </span>
      <span className={`${css.decor} ${css.ringStain}`} />
      <span className={`${css.decor} ${css.blood}`} />
      <span className={`${css.decor} ${css.bloodDrop}`} />

      <div className={css.pageHead}>
        <span className={css.stamp}>ХТО ЩЕ ДИХАЄ</span>
        <span className={css.pageNo}>стор. 112</span>
      </div>

      <div className={css.searchRow}>
        <IconSearch />
        <input
          ref={search}
          className={css.search}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="кого шукаємо?"
        />
      </div>

      <div className={css.inviteRow}>
        <button
          type="button"
          className={`${css.plate} ${css.inviteButton}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          <span className={css.plateLabel}>
            {invite.pending ? 'ВЯЖУ…' : 'БЕЗІМЕННА НИТКА'}
          </span>
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}

      <div className={css.entries}>
        {list.loadingChats && <p className={css.note}>гортаю сторінки…</p>}
        {!list.loadingChats && list.chats.length === 0 && (
          <p className={css.note}>жодного запису. поки що.</p>
        )}

        {list.chats.map((chat) => (
          <Link
            key={chat.id}
            href={chat.href ?? '#'}
            className={`${css.entry} ${chat.id === activeRoomId ? css.entryActive : ''}`}
          >
            <span className={css.entryTop}>
              <span className={css.bullet}>
                <IconSigil />
              </span>
              <span className={css.entryName}>{chat.name}</span>
              {chat.preview && <span className={css.entryTime}>{chat.preview.time}</span>}
            </span>
            <span
              className={`${css.entryNote} ${chat.preview?.own ? css.entryNoteOwn : ''}`}
            >
              {chat.preview?.text ?? chat.subtitle}
            </span>
          </Link>
        ))}

        {list.searching && (
          <>
            <p className={css.groupLabel}>ЩЕ НЕ ВПИСАНІ</p>
            {list.loadingPeople && <p className={css.note}>шукаю по картотеці…</p>}
            {!list.loadingPeople && list.people.length === 0 && (
              <p className={css.note}>нікого з таким іменем</p>
            )}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.entry}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={css.entryTop}>
                  <span className={`${css.bullet} ${css.bulletIdle}`}>
                    <IconRune />
                  </span>
                  <span className={css.entryName}>{person.name}</span>
                </span>
                <span className={css.entryNote}>{person.subtitle}</span>
              </button>
            ))}
          </>
        )}

        {list.openFailed && <p className={css.error}>сторінка не відкрилась</p>}
      </div>

      <div className={css.pageFoot}>
        <button type="button" className={css.footHint} onClick={() => search.current?.focus()}>
          + вписати нове ім’я
        </button>
        <span className={css.footStamp}>SALT · IRON · FIRE</span>
      </div>
    </section>
  );
}

/* ── Right page ────────────────────────────────────────────────────────── */

/** The right page before a hunt is picked: blank, with the house rules on it. */
function IdlePage() {
  return (
    <section className={`${css.page} ${css.pageRight}`}>
      <span className={`${css.margin} ${css.marginRight}`} />
      <span className={`${css.decor} ${css.trapBig}`}>
        <IconTrap size={460} stroke={0.18} />
      </span>
      <span className={`${css.decor} ${css.ringStain} ${css.ringStainHigh}`} />

      <div className={css.threadHead}>
        <span className={css.threadWho}>
          <span className={css.threadDate}>{today()}</span>
          <span className={css.threadTitle}>Чистий аркуш</span>
        </span>
        <span className={css.carved}>
          СІЛЬ · ЗАЛІЗО
          <br />
          ВОГОНЬ
        </span>
      </div>

      <div className={css.thread}>
        <p className={css.note}>обери ім’я на лівій сторінці — і запис відкриється тут.</p>
        <div className={css.warnBox}>
          <span className={css.warnSigil}>
            <IconSigil size={20} />
          </span>
          ЯКЩО ЛІНІЯ ОБІРВЕТЬСЯ НА ПІВСЛОВІ — СОЛИ ДВЕРІ, НЕ ВІДЧИНЯЙ
        </div>
      </div>
    </section>
  );
}

/**
 * A guest is written into the journal as `user3737` — a number, not a name.
 * This is the line where they sign it themselves, no account behind it.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span className={css.greetingLabel}>ПІДПИС:</span>
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
        {me.error ?? (me.pending ? 'вписую…' : me.dirty ? 'Enter — вписати' : 'можна змінити')}
      </span>
    </div>
  );
}

function ThreadPage({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={`${css.page} ${css.pageRight}`}>
      <span className={`${css.margin} ${css.marginRight}`} />
      <span className={`${css.decor} ${css.trapBig}`}>
        <IconTrap size={460} stroke={0.18} />
      </span>
      <span className={`${css.decor} ${css.ringStain} ${css.ringStainHigh}`} />

      <div className={css.threadHead}>
        <span className={css.threadWho}>
          <span className={css.threadDate}>
            {today()} · {room.connected ? 'ЛІНІЯ ЖИВА' : 'ЛІНІЯ МОВЧИТЬ'}
          </span>
          <span className={css.threadTitle}>{room.title}</span>
        </span>

        <span className={css.carved}>{room.peer ? `@${room.peer.username}` : 'ГУРТ'}</span>

        {/* The labels are hidden on a phone, so the buttons carry their own. */}
        <button
          type="button"
          className={css.plate}
          onClick={room.toggleCall}
          aria-label={room.inCall ? 'Обірвати дзвінок' : 'Подзвонити'}
        >
          {room.inCall ? <IconHangUp /> : <IconCall />}
          <span className={css.plateLabel}>{room.inCall ? 'ОБІРВАТИ' : 'ДЗВІНОК'}</span>
        </button>
        <button
          type="button"
          className={css.plate}
          onClick={room.leave}
          aria-label="Назад до списку"
        >
          <IconBack />
          <span className={css.plateLabel}>НАЗАД</span>
        </button>
      </div>

      <Greeting />

      {room.inCall && <Call roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.note}>піднімаю старі записи…</p>}

        {room.messages.map((message) =>
          message.call ? (
            <div key={message.id} className={css.callNotice}>
              <strong className={css.callNoticeText}>
                {message.call.kind === 'started' ? <IconCall /> : <IconHangUp />}
                {message.call.text.toUpperCase()}
                {message.call.duration && ` · ${message.call.duration}`}
              </strong>
              {message.call.hint && <span>{message.call.hint}</span>}
              {message.call.live && !room.inCall && (
                <button type="button" className={css.plate} onClick={room.joinCall}>
                  <IconCall />
                  <span className={css.plateLabel}>ПРИЄДНАТИСЬ</span>
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <span className={css.msgWho}>
                {(message.own ? 'я' : message.sender.displayName).toUpperCase()} · {message.time}
              </span>
              <span className={css.msgText}>{message.body}</span>
            </div>
          ),
        )}

        {/* The rule the mockup carves into the page, written down when it
            actually applies: the line has gone quiet. */}
        {!room.connected && (
          <div className={css.warnBox}>
            <span className={css.warnSigil}>
              <IconSigil size={20} />
            </span>
            ЛІНІЯ ОБІРВАЛАСЬ — ЧЕКАЙ, НЕ ЗАКРИВАЙ ЩОДЕННИК
          </div>
        )}

        <div ref={room.bottomRef} />
      </div>

      {room.typing.length > 0 && (
        <div className={css.typing}>{room.typing.join(', ')} ще пише…</div>
      )}

      <form
        className={css.composer}
        onSubmit={(event) => {
          event.preventDefault();
          room.send();
        }}
      >
        <span className={css.noteWrap}>
          <span className={css.tape} />
          <span className={css.inkBlot} />
          <input
            className={css.input}
            value={room.draft}
            onChange={(event) => room.setDraft(event.target.value)}
            placeholder="записати в щоденник…"
          />
        </span>
        <button
          type="submit"
          className={`${css.plate} ${css.plateSend}`}
          disabled={!room.draft.trim()}
        >
          <IconSend />
          <span className={css.plateLabel}>ЗАПИСАТИ</span>
        </button>
      </form>
    </section>
  );
}

/* ── The call ──────────────────────────────────────────────────────────── */

function Call({ roomId, onEnd }: { roomId: string; onEnd: () => void }) {
  const call = useCallController(roomId);

  if (call.connecting) return <p className={css.note}>набираю…</p>;
  if (call.error) return <p className={css.error}>ЛІНІЯ ГЛУХА: {call.error}</p>;
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
      <Photos />
      {/* Субтитри поки вимкнені: <Subtitles /> */}
    </CallRoot>
  );
}

function Photos() {
  const tracks = useCallStage();
  const controls = useCallControls();
  const { expanded, collapse, tileProps } = useCallExpansion();

  const buttons = (
    <>
      <button type="button" className={css.plate} onClick={controls.toggleMic}>
        <IconMic on={controls.micOn} />
        <span className={css.plateLabel}>{controls.micOn ? 'МІКРОФОН' : 'ТИША'}</span>
      </button>
      <button type="button" className={css.plate} onClick={controls.toggleCam}>
        <IconCam on={controls.camOn} />
        <span className={css.plateLabel}>{controls.camOn ? 'КАМЕРА' : 'ТЕМРЯВА'}</span>
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

      {/* Clicking a photo lays both of them out over the page, one above the
          other, with the controls pinned to the seam between them. */}
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
            <button type="button" className={css.plate} onClick={collapse}>
              <span className={css.plateLabel}>ЗГОРНУТИ</span>
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
          <span className={css.captionWho}>{line.participantName.toUpperCase()}</span>
          {line.text}
        </p>
      ))}
      {interim.map((line) => (
        <p key={line.key} className={css.captionInterim} style={{ margin: 0 }}>
          <span className={css.captionWho}>{line.participantName.toUpperCase()}</span>
          {line.text}
        </p>
      ))}
    </div>
  );
}

/* ── Bookmarks ─────────────────────────────────────────────────────────── */

/**
 * The tabs sticking out of the book's edge. They live outside `.book` because
 * that element animates a transform — anything inside it is trapped in its
 * stacking context and the skin menu could never open over the page.
 */
function Bookmarks() {
  const { signedIn, logout } = useSessionController();

  return (
    <div className={css.marks}>
      {signedIn && (
        <Link href="/" className={`${css.mark} ${css.markStrong}`}>
          <IconPeople />
          ХРОНІКИ
        </Link>
      )}

      <SigilPicker />

      {signedIn && (
        <button type="button" className={`${css.mark} ${css.markRed}`} onClick={logout}>
          <IconLogout />
          ВИХІД
        </button>
      )}
    </div>
  );
}

/** Changing the sigil changes the book. The skin picker, in the journal's terms. */
function SigilPicker() {
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

  return (
    <div ref={holder} className={css.markHolder}>
      <button
        type="button"
        className={css.mark}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconBook />
        СИГІЛИ
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
              {skin.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sign in ───────────────────────────────────────────────────────────── */

/** Before you are in the book you sign the ledger: one page, nothing else. */
/**
 * The page an invite link lands on. The controller joins and redirects on its
 * own, so all this draws is the wait and, when the link is dead, why.
 */
function InviteGate({ token }: { token: string }) {
  const join = useInviteAcceptController(token);

  return (
    <section className={`${css.page} ${css.pageRight} ${css.ledger}`}>
      <div className={css.pageHead}>
        <span className={css.stamp}>ЧУЖА НИТКА</span>
        <span className={css.pageNo}>стор. —</span>
      </div>

      {join.status === 'joining' ? (
        <p className={css.note}>Йдемо на голос…</p>
      ) : (
        <>
          <p className={css.error}>{join.error}</p>
          <button type="button" className={css.plate} onClick={() => location.assign('/')}>
            <span className={css.plateLabel}>ДО КНИГИ</span>
          </button>
        </>
      )}
    </section>
  );
}

function Ledger() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <section className={`${css.page} ${css.pageRight} ${css.ledger}`}>
      <div className={css.pageHead}>
        <span className={css.stamp}>{auth.mode === 'login' ? 'ВПІЗНАЙ МЕНЕ' : 'НОВЕ ІМ’Я'}</span>
        <span className={css.pageNo}>стор. 1</span>
      </div>

      <form
        className={css.ledgerForm}
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
              className={`${css.tab} ${auth.mode === mode ? css.tabActive : ''}`}
              onClick={() => auth.setMode(mode)}
            >
              {mode === 'login' ? 'ВХІД' : 'РЕЄСТРАЦІЯ'}
            </button>
          ))}
        </div>

        <label className={css.field}>
          <span className={css.label}>ПОШТА</span>
          <span className={css.fieldLine}>
            <input
              className={css.input}
              type="email"
              required
              value={auth.fields.email}
              onChange={(event) => auth.set('email', event.target.value)}
            />
          </span>
        </label>

        {auth.mode === 'register' && (
          <>
            <label className={css.field}>
              <span className={css.label}>ПОЗИВНИЙ</span>
              <span className={css.fieldLine}>
                <input
                  className={css.input}
                  required
                  minLength={3}
                  pattern="[A-Za-z0-9_.\-]+"
                  value={auth.fields.username}
                  onChange={(event) => auth.set('username', event.target.value)}
                />
              </span>
            </label>
            <label className={css.field}>
              <span className={css.label}>ІМ’Я В ЗАПИСАХ</span>
              <span className={css.fieldLine}>
                <input
                  className={css.input}
                  required
                  value={auth.fields.displayName}
                  onChange={(event) => auth.set('displayName', event.target.value)}
                />
              </span>
            </label>
          </>
        )}

        <label className={css.field}>
          <span className={css.label}>ПАРОЛЬ</span>
          <span className={css.fieldLine}>
            <input
              className={css.input}
              type="password"
              required
              minLength={8}
              value={auth.fields.password}
              onChange={(event) => auth.set('password', event.target.value)}
            />
          </span>
        </label>

        {auth.error && <p className={css.error}>{auth.error}</p>}

        <button type="submit" className={`${css.plate} ${css.ledgerSubmit}`} disabled={auth.pending}>
          <IconSend />
          <span className={css.plateLabel}>
            {auth.pending ? 'ЧЕКАЙ…' : auth.mode === 'login' ? 'ВІДКРИТИ' : 'ВПИСАТИ'}
          </span>
        </button>

        <div className={css.orRule}>або</div>

        {/* No account needed: this makes a room and a link to it, nothing else. */}
        <button
          type="button"
          className={`${css.plate} ${css.ledgerSubmit}`}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          <IconLink />
          <span className={css.plateLabel}>
            {invite.pending ? 'ВЯЖУ…' : 'БЕЗІМЕННА НИТКА'}
          </span>
        </button>
        {invite.error && <p className={css.error}>{invite.error}</p>}
      </form>
    </section>
  );
}

/** The date at the head of every entry, the way it is written in the book. */
function today() {
  return new Date()
    .toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
    .toUpperCase();
}
