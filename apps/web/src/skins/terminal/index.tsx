'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  useAuthController,
  useChatListController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import { CallPane } from './CallPane';
import { GLYPH } from './glyphs';
import css from './terminal.module.css';

export const terminalManifest: SkinManifest = {
  id: 'terminal',
  label: 'MS-DOS',
  description: 'Текстовий режим BBS: один лог, індекс каналів, F-клавіші',
  scheme: 'dark',
  preview: ['#ffff55', '#001f9e', '#55ffff'],
};

/**
 * Terminal's architecture is not a layout of panels — it is one screen at a
 * time, like a BBS: an index of channels, or the log of one channel, with a
 * prompt at the bottom and a function-key strip under it.
 */
export function TerminalSkin({ view }: SkinProps) {
  const [dialog, setDialog] = useState<'skins' | null>(null);

  // F2 opens the skin list, Esc closes whatever is open — the shortcuts a
  // text-mode program is expected to have.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        setDialog((current) => (current ? null : 'skins'));
      }
      if (event.key === 'Escape') setDialog(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={css.root}>
      <div className={css.scanlines} />
      <StatusLine />

      {/* Each screen brings its own function-key strip: the keys a text-mode
          program offers are part of the screen, not a fixed toolbar. */}
      {view.name === 'invite' && <InviteGate token={view.token} />}
      {view.name === 'auth' && <LoginScreen />}
      {view.name === 'home' && <ChannelIndex />}
      {view.name === 'room' && (
        <ChannelLog roomId={view.roomId} onSkins={() => setDialog('skins')} />
      )}

      {view.name !== 'room' && view.name !== 'invite' && (
        <FunctionKeys onSkins={() => setDialog('skins')} />
      )}

      {dialog === 'skins' && <SkinDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function StatusLine() {
  const { user } = useSessionController();

  return (
    <div className={css.topBar}>
      <span>
        {GLYPH.node} UNKNOWN-BBS 2.1
      </span>
      <span className={css.topSpacer} />
      <span>{user ? `${GLYPH.user} USER: ${user.username}` : 'NOT LOGGED IN'}</span>
      <span className={css.topNode}>NODE 03</span>
    </div>
  );
}

function ChannelIndex() {
  const list = useChatListController();
  const router = useRouter();

  return (
    <div className={css.screen}>
      <p className={css.heading}>{GLYPH.index} CHANNEL INDEX</p>
      <p className={css.rule}>{'═'.repeat(120)}</p>

      <div className={css.index}>
        {list.loadingChats && <p className={css.system}>reading index…</p>}
        {!list.loadingChats && list.chats.length === 0 && (
          <p className={css.system}>no channels. type a name below to search.</p>
        )}

        {list.chats.map((chat, index) => (
          <button
            key={chat.id}
            type="button"
            className={css.entry}
            onClick={() => router.push(chat.href ?? '/')}
          >
            <span className={css.entryNum}>{GLYPH.channel}{String(index + 1).padStart(2, '0')}</span>
            <span className={css.entryName}>{chat.name}</span>
            <span className={css.entryMeta}>{chat.subtitle}</span>
          </button>
        ))}

        {list.searching && (
          <>
            <p className={css.rule} style={{ marginTop: 12 }}>
              {'─'.repeat(120)}
            </p>
            <p className={css.heading}>{GLYPH.person} USERS</p>
            {list.loadingPeople && <p className={css.system}>scanning…</p>}
            {!list.loadingPeople && list.people.length === 0 && (
              <p className={css.system}>no match</p>
            )}
            {list.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.entry}
                disabled={list.opening}
                onClick={person.open}
              >
                <span className={css.entryNum}>+</span>
                <span className={css.entryName}>{person.name}</span>
                <span className={css.entryMeta}>{person.subtitle}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className={css.prompt}>
        <span className={css.promptSign}>{GLYPH.search} find&gt;</span>
        <input
          className={css.input}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="ім’я користувача або каналу…"
        />
      </div>
    </div>
  );
}

function ChannelLog({ roomId, onSkins }: { roomId: string; onSkins: () => void }) {
  const room = useRoomController(roomId);

  // F3 starts and ends the call — a text-mode client has no buttons to click,
  // so the key strip below is the whole call UI.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F3') return;
      event.preventDefault();
      room.toggleCall();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [room]);

  return (
    <>
      <div className={css.screen}>
        <p className={css.heading}>
          #{room.title} {room.peer ? `(@${room.peer.username})` : ''}
        </p>
        <p className={css.rule}>{'═'.repeat(120)}</p>

        {room.inCall && <CallPane roomId={roomId} onEnd={room.toggleCall} />}

        <div className={css.log}>
          {room.loadingHistory && <p className={css.system}>* loading backlog…</p>}
          <p className={css.system}>* joined #{room.title}</p>

          {room.messages.map((message) =>
            message.call ? (
              <div key={message.id} className={css.callNotice}>
                <span className={css.stamp}>[{message.time}]</span>
                <strong className={css.callNoticeText}>
                  {message.call.kind === 'started' ? GLYPH.camera : GLYPH.call}{' '}
                  {message.call.text.toUpperCase()}
                  {message.call.duration && ` · ${message.call.duration}`}
                </strong>
                {message.call.hint && <span>{message.call.hint}</span>}
                {message.call.live && !room.inCall && (
                  <button type="button" className={css.key} onClick={room.joinCall}>
                    {GLYPH.call} JOIN
                  </button>
                )}
              </div>
            ) : (
              <div key={message.id} className={css.line}>
                <span className={css.stamp}>[{message.time}]</span>
                <span className={`${css.nick} ${message.own ? css.nickOwn : ''}`}>
                  &lt;{message.sender.username}&gt;
                </span>
                <span className={css.text}>{message.body}</span>
              </div>
            ),
          )}

          {room.typing.length > 0 && (
            <p className={css.system}>* {room.typing.join(', ')} is typing…</p>
          )}
          {!room.connected && <p className={css.system}>* link lost, reconnecting…</p>}

          <div ref={room.bottomRef} />
        </div>

        <form
          className={css.prompt}
          onSubmit={(event) => {
            event.preventDefault();
            room.send();
          }}
        >
          <span className={css.promptSign}>{GLYPH.send}</span>
          <input
            className={css.input}
            value={room.draft}
            onChange={(event) => room.setDraft(event.target.value)}
            placeholder="повідомлення…"
            autoFocus
          />
        </form>
      </div>

      <CallKeys
        inCall={room.inCall}
        onCall={room.toggleCall}
        onLeave={room.leave}
        onSkins={onSkins}
      />
    </>
  );
}

/**
 * The room's key strip. F2 stays on it: the skin picker has to be reachable
 * from every screen, and in a text-mode client the strip is the only chrome
 * there is.
 */
function CallKeys({
  inCall,
  onCall,
  onLeave,
  onSkins,
}: {
  inCall: boolean;
  onCall: () => void;
  onLeave: () => void;
  onSkins: () => void;
}) {
  const { logout } = useSessionController();
  const invite = useInviteController();

  // F4 cuts a link the same way it does on the index screen: a text-mode
  // client has no other chrome, so a key missing here is a feature missing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F4') return;
      event.preventDefault();
      void invite.create();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invite]);

  return (
    <div className={css.keys}>
      <button type="button" className={css.key} onClick={onLeave}>
        F1
      </button>
      <span className={css.keyLabel}>{GLYPH.index} INDEX</span>
      <button type="button" className={css.key} onClick={onSkins}>
        F2
      </button>
      <span className={css.keyLabel}>{GLYPH.skin} SKIN</span>
      <button type="button" className={css.key} onClick={onCall}>
        F3
      </button>
      <span className={css.keyLabel}>
        {GLYPH.call} {inCall ? 'HANG UP' : 'CALL'}
      </span>
      <button
        type="button"
        className={css.key}
        onClick={() => void invite.create()}
        disabled={invite.pending}
      >
        F4
      </button>
      <span className={css.keyLabel}>
        {GLYPH.link} {invite.pending ? 'CUTTING…' : 'ANON LINK'}
      </span>
      <button type="button" className={css.key} onClick={logout}>
        F10
      </button>
      <span className={css.keyLabel}>{GLYPH.logout} LOGOUT</span>
      <span className={css.keyFill} />
    </div>
  );
}

function LoginScreen() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <div className={`${css.screen} ${css.screenAuth}`}>
      <p className={css.heading}>{GLYPH.user} LOGIN</p>
      <p className={css.rule}>{'═'.repeat(120)}</p>

      <form
        className={css.dialogBody}
        style={{ maxWidth: 620 }}
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
              {mode === 'login' ? '[1] SIGN IN' : '[2] NEW USER'}
            </button>
          ))}
        </div>

        <label className={css.field}>
          <span className={css.fieldLabel}>EMAIL:</span>
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
              <span className={css.fieldLabel}>HANDLE:</span>
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
              <span className={css.fieldLabel}>REAL NAME:</span>
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
          <span className={css.fieldLabel}>PASSWORD:</span>
          <input
            className={css.fieldInput}
            type="password"
            required
            minLength={8}
            value={auth.fields.password}
            onChange={(event) => auth.set('password', event.target.value)}
          />
        </label>

        {auth.error && <p className={css.error}>! {auth.error}</p>}

        <button type="submit" className={css.action} disabled={auth.pending}>
          {auth.pending ? 'working…' : 'connect'}
        </button>

        <p className={css.rule}>{'─'.repeat(120)}</p>

        {/* No account needed: this makes a room and a link to it, nothing else. */}
        <button
          type="button"
          className={css.action}
          onClick={() => void invite.create()}
          disabled={invite.pending}
        >
          {invite.pending ? 'cutting link…' : `${GLYPH.link} anon link, no signup`}
        </button>
        {invite.error && <p className={css.error}>! {invite.error}</p>}
      </form>
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
    <div className={css.screen}>
      <p className={css.heading}>{GLYPH.link} INVITE</p>
      <p className={css.rule}>{'═'.repeat(120)}</p>

      <div className={css.index}>
        {join.status === 'joining' ? (
          <p className={css.system}>* opening anonymous channel…</p>
        ) : (
          <>
            <p className={css.error}>! {join.error}</p>
            <button type="button" className={css.action} onClick={() => location.assign('/')}>
              index
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FunctionKeys({ onSkins }: { onSkins: () => void }) {
  const { signedIn, logout } = useSessionController();
  const invite = useInviteController();
  const router = useRouter();

  // A key drawn on the strip has to answer to the key it names.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F4') return;
      event.preventDefault();
      void invite.create();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invite]);

  return (
    <div className={css.keys}>
      <button type="button" className={css.key} onClick={() => router.push('/')}>
        F1
      </button>
      <span className={css.keyLabel}>INDEX</span>
      <button type="button" className={css.key} onClick={onSkins}>
        F2
      </button>
      <span className={css.keyLabel}>{GLYPH.skin} SKIN</span>
      {/* No account needed: F4 makes a room and a link to it, nothing else. */}
      <button
        type="button"
        className={css.key}
        onClick={() => void invite.create()}
        disabled={invite.pending}
      >
        F4
      </button>
      <span className={css.keyLabel}>
        {GLYPH.link} {invite.pending ? 'CUTTING…' : 'ANON LINK'}
      </span>
      {signedIn && (
        <>
          <button type="button" className={css.key} onClick={logout}>
            F10
          </button>
          <span className={css.keyLabel}>{GLYPH.logout} LOGOUT</span>
        </>
      )}
      <span className={css.keyFill} />
    </div>
  );
}

function SkinDialog({ onClose }: { onClose: () => void }) {
  const { skinId, skins, apply } = useSkinEngine();

  return (
    <div className={css.dialogWrap} onClick={onClose}>
      <div className={css.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={css.dialogTitle}>{GLYPH.skin} Select skin</div>
        <div className={css.dialogBody}>
          {skins.map((skin, index) => (
            <button
              key={skin.id}
              type="button"
              className={`${css.option} ${skin.id === skinId ? css.optionActive : ''}`}
              onClick={() => {
                apply(skin.id);
                onClose();
              }}
            >
              <span className={css.entryNum}>{index + 1}.</span>
              <span className={css.swatch}>
                {skin.preview.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span>{skin.label}</span>
            </button>
          ))}
          <p className={css.system}>Esc — закрити · F2 — відкрити знову</p>
        </div>
      </div>
    </div>
  );
}
