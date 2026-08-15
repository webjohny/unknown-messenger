'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  initials,
  useAuthController,
  useChatListController,
  useIdentityController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import { CallBlock } from './CallBlock';
import {
  IconBack,
  IconCall,
  IconHangUp,
  IconLogout,
  IconSearch,
  IconSend,
  IconSkin,
  IconThread,
} from './icons';
import css from './brutal.module.css';

export const brutalManifest: SkinManifest = {
  id: 'brutal',
  label: 'Neo-Brutalism',
  description: 'Чорні рамки, тверді тіні, моноширинний капс',
  scheme: 'light',
  preview: ['#d6ff2e', '#000000', '#e8e4d8'],
};

/**
 * Brutal's architecture: a top bar, then two columns of hard-edged blocks.
 * Nothing is soft, nothing is nested more than it must be.
 */
export function BrutalSkin({ view }: SkinProps) {
  return (
    <div className={css.root}>
      <TopBar />

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <Auth />
      ) : (
        <div
          className={`${css.columns} ${view.name === 'room' ? css.columnsRoom : css.columnsList}`}
        >
          <aside className={css.side}>
            <ContactsBlock activeRoomId={view.name === 'room' ? view.roomId : undefined} />
          </aside>

          {view.name === 'room' ? (
            <Thread roomId={view.roomId} />
          ) : (
            <section className={`${css.block} ${css.main}`}>
              <div className={css.blockHead}>NO THREAD SELECTED</div>
              <div className={css.empty}>Оберіть контакт зліва</div>
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
    <header className={css.bar}>
      <div className={css.brand}>Unknown//Msg</div>
      <SkinPicker />
      <button type="button" className={`${css.barItem} ${css.barItemExtra}`}>
        Keys
      </button>
      {signedIn && (
        <button type="button" className={css.barItem} onClick={logout}>
          <IconLogout />
          Logout
        </button>
      )}
      <span className={css.barTail}>
        {user ? `${user.username.toUpperCase()} / ONLINE` : 'V0.9.4 / OFFLINE'}
      </span>
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

  return (
    <div ref={holder} className={css.skinHolder}>
      <button
        type="button"
        className={`${css.barItem} ${open ? css.barItemOpen : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconSkin />
        Skin ▾
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

function ContactsBlock({ activeRoomId }: { activeRoomId?: string }) {
  const list = useChatListController();
  const invite = useInviteController();

  return (
    <>
      <div className={`${css.block}`} style={{ flex: 1, minHeight: 0 }}>
        <div className={css.blockHead}>
          <IconThread />
          Contacts [{list.chats.length}]
        </div>
        <div className={css.searchRow}>
          <IconSearch />
          <input
            className={css.search}
            value={list.term}
            onChange={(event) => list.setTerm(event.target.value)}
            placeholder="SEARCH…"
          />
        </div>

        <div className={css.list}>
          <div className={css.groupLabel}>■ Threads</div>

          {list.loadingChats && <p className={css.note}>Loading…</p>}
          {!list.loadingChats && list.chats.length === 0 && <p className={css.note}>Empty</p>}

          {list.chats.map((chat) => (
            <Link
              key={chat.id}
              href={chat.href ?? '#'}
              className={`${css.row} ${chat.id === activeRoomId ? css.rowActive : ''}`}
            >
              <span className={css.mark} />
              <span className={css.rowName}>{chat.name}</span>
            </Link>
          ))}

          {list.searching && (
            <>
              <div className={css.groupLabel}>□ People</div>
              {list.loadingPeople && <p className={css.note}>Scanning…</p>}
              {!list.loadingPeople && list.people.length === 0 && (
                <p className={css.note}>No match</p>
              )}
              {list.people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={css.row}
                  disabled={list.opening}
                  onClick={person.open}
                >
                  <span className={`${css.mark} ${css.markHollow}`} />
                  <span className={css.rowName}>{person.name}</span>
                  <span className={css.badge}>{list.opening ? '…' : 'OPEN'}</span>
                </button>
              ))}
            </>
          )}

          {list.openFailed && <p className={css.note}>Open failed</p>}
        </div>
      </div>

      <div className={css.sideButtons}>
        <button
          type="button"
          className={css.chunky}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          {invite.pending ? '…' : '⛓ Anon link'}
        </button>
        <button
          type="button"
          className={`${css.chunky} ${css.chunkyPlain}`}
          onClick={() => list.setTerm('')}
        >
          + Reset
        </button>
      </div>
      {invite.error && <p className={css.note}>{invite.error}</p>}
    </>
  );
}

/**
 * A guest arrives as `user3737` — a number, not a name. This band is where it
 * gets typed over, no account required.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span>ПРИВІТ,</span>
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
        {me.error ?? (me.pending ? 'ЗБЕРІГАЄМО…' : me.dirty ? 'ENTER — ЗБЕРЕГТИ' : 'МОЖНА ЗМІНИТИ')}
      </span>
    </div>
  );
}

function Thread({ roomId }: { roomId: string }) {
  const room = useRoomController(roomId);

  return (
    <section className={`${css.block} ${css.main}`}>
      <div className={css.peerHead}>
        <span className={css.peerMark}>{initials(room.title)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.peerName}>{room.title}</span>
          <span className={css.peerMeta}>
            {room.peer ? `@${room.peer.username}` : 'GROUP'} ·{' '}
            {room.connected ? 'LINK UP' : 'LINK DOWN'}
          </span>
        </span>
      </div>

      <div className={css.actions}>
        <button
          type="button"
          className={`${css.action} ${room.inCall ? css.actionDanger : css.actionOn}`}
          onClick={room.toggleCall}
        >
          {room.inCall ? <IconHangUp /> : <IconCall />}
          {room.inCall ? 'End call' : 'Video call'}
        </button>
        <button type="button" className={css.action} onClick={room.leave}>
          <IconBack />
          Threads
        </button>
      </div>

      <Greeting />

      {room.inCall && <CallBlock roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.note}>Loading history…</p>}

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
                <button type="button" className={css.callNoticeJoin} onClick={room.joinCall}>
                  <IconCall />
                  Join
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <div className={css.msgWho}>
                {message.sender.displayName} / {message.time}
              </div>
              <div className={css.msgBody}>{message.body}</div>
            </div>
          ),
        )}

        <div ref={room.bottomRef} />
      </div>

      <div className={css.status}>
        {room.typing.length > 0
          ? `${room.typing.join(', ')} typing…`
          : room.connected
            ? 'E2E ✓ verified'
            : 'reconnecting…'}
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
          placeholder="TYPE…"
        />
        <button type="submit" className={css.send} disabled={!room.draft.trim()}>
          <IconSend />
          Send
        </button>
      </form>
    </section>
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
      <div className={css.authBox}>
        <div className={css.block}>
          <div className={css.blockHead}>Invite link</div>
          <div className={css.authBody}>
            {join.status === 'joining' ? (
              <p className={css.note}>Opening anon room…</p>
            ) : (
              <>
                <p className={css.error}>{join.error}</p>
                <button type="button" className={css.chunky} onClick={() => location.assign('/')}>
                  Home
                </button>
              </>
            )}
          </div>
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
      <div className={css.authBox}>
        <div className={css.block}>
          <div className={css.blockHead}>
            {auth.mode === 'login' ? 'Access terminal' : 'New identity'}
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
                  className={`${css.tab} ${auth.mode === mode ? css.tabActive : ''}`}
                  onClick={() => auth.setMode(mode)}
                >
                  {mode === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <label className={css.field}>
              Email
              <input
                className={css.fieldInput}
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
                    className={css.fieldInput}
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
                    className={css.fieldInput}
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
                className={css.fieldInput}
                type="password"
                required
                minLength={8}
                value={auth.fields.password}
                onChange={(event) => auth.set('password', event.target.value)}
              />
            </label>

            {auth.error && <p className={css.error}>{auth.error}</p>}

            <button type="submit" className={css.chunky} disabled={auth.pending}>
              {auth.pending ? 'Working…' : auth.mode === 'login' ? 'Enter' : 'Create'}
            </button>

            <div className={css.orRule}>або</div>

            {/* No account needed: this makes a room and a link to it, nothing else. */}
            <button
              type="button"
              className={`${css.chunky} ${css.chunkyPlain}`}
              onClick={() => void invite.create()}
              disabled={invite.pending}
            >
              {invite.pending ? 'Cutting link…' : '⛓ Anon link, no signup'}
            </button>
            {invite.error && <p className={css.error}>{invite.error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
