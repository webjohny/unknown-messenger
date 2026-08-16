import { useEffect, useRef, useState } from 'react';

import {
  initials,
  useAuthController,
  useChatListController,
  useIdentityController,
  useInviteAcceptController,
  useInviteController,
  useNavigation,
  useRoomController,
  useSessionController,
  useSessionSocket,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import { CallDeck } from './CallDeck';
import css from './spatial-light.module.css';
import { seedPosition, useCanvas, type Point } from './useCanvas';

export const spatialLightManifest: SkinManifest = {
  id: 'spatial-light',
  label: 'Spatial Light',
  description: 'Вузли на сітці: тягни, клікни — відкрити, клікни ще — закрити',
  scheme: 'light',
  preview: ['#ea580c', '#eef0f6', '#4338ca'],
};

/** Two accent tints, alternating per node, as in the design. */
const TINTS = ['#f97316', '#6366f1'];

/** Kept in step with the exit animation in the stylesheet. */
const EXIT_MS = 220;

/**
 * Spatial Light is not a sidebar-and-thread messenger. The whole screen is one
 * canvas: chats are draggable nodes, opening one floats a draggable panel over
 * the canvas, and curves connect the other nodes to it. Routing still decides
 * what is open, so a node click navigates and the close button goes back.
 */
export function SpatialLightSkin({ view }: SkinProps) {
  const canvas = useCanvas();
  const { connected } = useSessionSocket();

  return (
    <div ref={canvas.stageRef} className={css.stage}>
      <div className={css.gridFine} />
      <div className={css.gridCoarse} />

      <div className={css.brandBar}>
        <span className={css.brand}>Unknown</span>
        <span className={css.brandTag}>SPATIAL / LIGHT</span>
        <span className={css.hint}>drag nodes · click to open · click again to close</span>
      </div>

      <div className={css.tools}>
        <span className={`${css.status} ${connected ? '' : css.statusDown}`}>
          <span className={css.statusDot} />
          {connected ? 'MESH LIVE' : 'MESH DOWN'}
        </span>
        <SkinPicker />
        <InviteTool />
        <SessionTools onReset={canvas.reset} />
      </div>

      {view.name === 'invite' ? (
        <InviteGate token={view.token} />
      ) : view.name === 'auth' ? (
        <SignIn />
      ) : (
        <Canvas
          canvas={canvas}
          activeRoomId={view.name === 'room' ? view.roomId : null}
        />
      )}
    </div>
  );
}

type Canvas = ReturnType<typeof useCanvas>;

function Canvas({ canvas, activeRoomId }: { canvas: Canvas; activeRoomId: string | null }) {
  const list = useChatListController();
  const nav = useNavigation();

  const nodes = list.chats.map((chat, index) => ({
    chat,
    tint: TINTS[index % TINTS.length],
    at: canvas.positions[chat.id] ?? seedPosition(chat.id, index),
  }));

  const panelId = '__panel';
  const panelAt = canvas.positions[panelId] ?? { x: 470, y: 96 };

  // Closing plays first and navigates after. Going back to `/` is a different
  // route, so it unmounts this skin — navigate straight away and there is
  // nothing left on screen to animate out.
  const [closing, setClosing] = useState(false);

  // The skin now outlives navigation, so this flag has to be cleared whenever a
  // room opens — left set, the next panel would open already animating out.
  useEffect(() => setClosing(false), [activeRoomId]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => nav.push('/'), EXIT_MS);
  };

  // The node that spoke last gets the halo and the animated dots.
  const newestId = [...nodes]
    .filter((node) => node.chat.preview)
    .sort((a, b) => (a.chat.preview!.at < b.chat.preview!.at ? 1 : -1))[0]?.chat.id;

  return (
    <>
      {/* Curves from the other nodes to the open panel; they draw themselves in
          with the panel and fade out with it. */}
      {activeRoomId && (
        <svg className={`${css.links} ${closing ? css.linksLeaving : ''}`}>
          {nodes
            .filter((node) => node.chat.id !== activeRoomId)
            .slice(0, 3)
            .map((node, index) => (
              <path
                key={node.chat.id}
                className={css.linkPath}
                pathLength={1}
                d={linkPath(node.at, panelAt)}
                fill="none"
                strokeWidth={index === 0 ? 2 : 1.5}
                stroke={index === 0 ? 'rgba(234,88,12,.4)' : 'rgba(99,102,241,.28)'}
                style={{ animationDelay: `${index * 60}ms` }}
              />
            ))}
        </svg>
      )}

      {nodes.map((node) => {
        const isActive = node.chat.id === activeRoomId;
        return (
          <div
            key={node.chat.id}
            className={css.node}
            style={{
              left: node.at.x,
              top: node.at.y,
              zIndex: canvas.draggingId === node.chat.id ? 25 : isActive ? 14 : 12,
              cursor: canvas.draggingId === node.chat.id ? 'grabbing' : 'grab',
              transition: canvas.draggingId === node.chat.id ? 'none' : 'left .18s ease-out, top .18s ease-out',
            }}
            onPointerDown={(event) =>
              canvas.startDrag(node.chat.id, node.at, event, () =>
                // Click on the open node closes it; on any other, opens it.
                isActive ? close() : node.chat.open(),
              )
            }
          >
            <div
              className={`${css.pill} ${isActive ? css.pillActive : ''} ${
                !isActive && node.chat.id === newestId ? css.pillPulse : ''
              }`}
            >
              <span className={css.avatar} style={{ background: node.tint }}>
                {initials(node.chat.name)}
                <span className={css.dot} style={{ background: isActive ? '#f97316' : '#14b8a6' }} />
              </span>
              <span>
                <span className={css.nodeName}>{node.chat.name}</span>
                <span className={css.nodeSub}>{node.chat.subtitle.toUpperCase()}</span>
              </span>
            </div>

            {/* The last thing said, hanging off the node — hidden once its
                conversation is open, where the thread shows it anyway. */}
            {!isActive && node.chat.preview && (
              <div className={css.typing}>
                {node.chat.preview.own ? 'Ви: ' : ''}
                {node.chat.preview.text}
                {node.chat.id === newestId && (
                  <span className={css.typingDots}>
                    <span />
                    <span />
                    <span />
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {list.chats.length === 0 && !list.loadingChats && (
        <p className={css.emptyHint}>
          NO NODES ON THE MESH
          <br />
          знайдіть співрозмовника нижче
        </p>
      )}

      <Finder list={list} hidden={Boolean(activeRoomId)} />

      {activeRoomId && (
        <Panel
          key={activeRoomId}
          roomId={activeRoomId}
          at={panelAt}
          dragging={canvas.draggingId === panelId}
          phase={closing ? 'leaving' : 'entering'}
          onClose={close}
          onHeadDown={(event) => canvas.startDrag(panelId, panelAt, event)}
        />
      )}
    </>
  );
}

/** Search lives on the canvas itself, bottom-left, out of the panel's way. */
function Finder({
  list,
  hidden,
}: {
  list: ReturnType<typeof useChatListController>;
  hidden: boolean;
}) {
  return (
    <div className={`${css.finder} ${hidden ? css.finderBehind : ''}`}>
      <div className={css.inputRow}>
        <input
          className={css.input}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="find a node…"
        />
      </div>

      {list.searching && (
        <div className={css.skinMenu} style={{ position: 'static', marginTop: 10 }}>
          {list.loadingPeople && <p className={css.note}>SCANNING…</p>}
          {!list.loadingPeople && list.people.length === 0 && <p className={css.note}>NO MATCH</p>}
          {list.people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={css.skinOption}
              disabled={list.opening}
              onClick={person.open}
            >
              <span className={css.avatar} style={{ width: 26, height: 26, borderRadius: 9, background: '#6366f1', fontSize: 10 }}>
                {initials(person.name)}
              </span>
              <span>{person.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({
  roomId,
  at,
  dragging,
  phase,
  onClose,
  onHeadDown,
}: {
  roomId: string;
  at: Point;
  dragging: boolean;
  phase: 'entering' | 'leaving';
  onClose: () => void;
  onHeadDown: (event: React.PointerEvent) => void;
}) {
  const room = useRoomController(roomId);

  return (
    <div
      className={`${css.panel} ${phase === 'leaving' ? css.panelLeaving : css.panelEntering}`}
      style={{ left: at.x, top: at.y, zIndex: dragging ? 26 : 18 }}
    >
      <div className={css.panelHead} onPointerDown={onHeadDown}>
        <span className={css.panelAvatar} style={{ background: '#f97316' }}>
          {initials(room.title)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.panelName}>{room.title}</span>
          <span className={css.panelMeta}>
            SESSION · {room.peer ? `@${room.peer.username}` : 'GROUP'} ·{' '}
            {room.connected ? 'LINKED' : 'NO LINK'}
          </span>
        </span>
        <span className={css.panelActions}>
          <button
            type="button"
            className={`${css.callButton} ${room.inCall ? css.callButtonEnd : ''}`}
            onClick={room.toggleCall}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {room.inCall ? 'END' : 'CALL'}
          </button>
          <button
            type="button"
            className={`${css.iconButton} ${css.closeButton}`}
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="Закрити"
          >
            ✕
          </button>
        </span>
      </div>

      <Greeting />

      {room.inCall && <CallDeck roomId={roomId} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.system}>LOADING THREAD…</p>}

        {room.messages.map((message) =>
          message.call ? (
            <div key={message.id} className={css.callNotice}>
              <strong className={css.callNoticeText}>
                <span aria-hidden>{message.call.kind === 'started' ? '▶' : '■'}</span>
                {message.call.text.toUpperCase()}
                {message.call.duration && ` · ${message.call.duration}`}
              </strong>
              {message.call.hint && <span>{message.call.hint}</span>}
              {message.call.live && !room.inCall && (
                <button type="button" className={css.callButton} onClick={room.joinCall}>
                  ◉ ПРИЄДНАТИСЬ
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <div className={css.msgMeta}>
                {message.own ? 'YOU' : message.sender.displayName.toUpperCase()} · {message.time}
              </div>
              <div className={css.bubble}>{message.body}</div>
            </div>
          ),
        )}

        {room.typing.length > 0 && (
          <p className={css.system}>{room.typing.join(', ').toUpperCase()} IS TYPING…</p>
        )}

        <div ref={room.bottomRef} />
      </div>

      <form
        className={css.composer}
        onSubmit={(event) => {
          event.preventDefault();
          room.send();
        }}
      >
        <span className={css.plus}>＋</span>
        <span className={css.inputRow}>
          <input
            className={css.input}
            value={room.draft}
            onChange={(event) => room.setDraft(event.target.value)}
            placeholder="message this node…"
            maxLength={512}
          />
          <span className={css.counter}>{room.draft.length}/512</span>
        </span>
        <button type="submit" className={css.send} disabled={!room.draft.trim()}>
          SEND
        </button>
      </form>
    </div>
  );
}

/**
 * A guest is issued `user3737` — a serial, not a name. This row is where the
 * node gets relabelled, with no account behind it.
 */
function Greeting() {
  const me = useIdentityController();
  if (!me.editable) return null;

  return (
    <div className={css.greeting}>
      <span className={css.greetingLabel}>YOU ARE</span>
      <input
        className={css.greetingInput}
        value={me.draft}
        maxLength={me.maxLength}
        disabled={me.pending}
        aria-label="Ваше ім’я в чаті"
        onChange={(event) => me.setDraft(event.target.value)}
        onBlur={me.save}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') me.cancel();
        }}
      />
      <span className={me.error ? css.greetingError : css.greetingHint}>
        {me.error ?? (me.pending ? 'SAVING…' : me.dirty ? 'ENTER TO SAVE' : 'EDITABLE')}
      </span>
    </div>
  );
}

function linkPath(node: Point, panel: Point): string {
  return `M${node.x + 70} ${node.y + 28} C ${node.x + 220} ${node.y + 10}, ${panel.x - 90} ${
    panel.y + 180
  }, ${panel.x} ${panel.y + 220}`;
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
        className={css.tool}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        SKIN · {current?.label.toUpperCase()}
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

/** Cuts a link to a brand-new anonymous mesh; works with no account at all. */
function InviteTool() {
  const invite = useInviteController();

  return (
    <button
      type="button"
      className={css.tool}
      onClick={() => void invite.create()}
      disabled={invite.pending}
    >
      {invite.pending ? 'CUTTING…' : 'ANON LINK'}
    </button>
  );
}

function SessionTools({ onReset }: { onReset: () => void }) {
  const { signedIn, logout } = useSessionController();

  return (
    <>
      <button type="button" className={css.tool} onClick={onReset}>
        RESET LAYOUT
      </button>
      {signedIn && (
        <button type="button" className={`${css.tool} ${css.toolSecondary}`} onClick={logout}>
          SIGN OUT
        </button>
      )}
    </>
  );
}

/**
 * The card an invite link lands on. The controller joins and redirects on its
 * own, so all this draws is the wait and, when the link is dead, why.
 */
function InviteGate({ token }: { token: string }) {
  const join = useInviteAcceptController(token);

  return (
    <div className={css.authCard}>
      <span className={css.brandTag}>INVITE LINK</span>
      {join.status === 'joining' ? (
        <p className={css.note}>JOINING ANON MESH…</p>
      ) : (
        <>
          <p className={css.error}>{join.error}</p>
          <button
            type="button"
            className={css.send}
            style={{ width: '100%', height: 46 }}
            onClick={() => location.assign('/')}
          >
            HOME
          </button>
        </>
      )}
    </div>
  );
}

function SignIn() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <form
      className={css.authCard}
      onSubmit={(event) => {
        event.preventDefault();
        void auth.submit();
      }}
    >
      <span className={css.brandTag}>{auth.mode === 'login' ? 'JOIN THE MESH' : 'NEW NODE'}</span>

      <div className={css.tabs}>
        {(['login', 'register'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={css.tool}
            style={auth.mode === mode ? { background: '#eef0ff', borderColor: '#4338ca' } : undefined}
            onClick={() => auth.setMode(mode)}
          >
            {mode === 'login' ? 'SIGN IN' : 'REGISTER'}
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

      <button type="submit" className={css.send} style={{ width: '100%', height: 46 }} disabled={auth.pending}>
        {auth.pending ? 'WORKING…' : auth.mode === 'login' ? 'ENTER' : 'CREATE'}
      </button>

      <div className={css.orRule}>or</div>

      {/* No account needed: this makes a room and a link to it, nothing else. */}
      <button
        type="button"
        className={`${css.tool} ${css.inviteButton}`}
        onClick={() => void invite.create()}
        disabled={invite.pending}
      >
        {invite.pending ? 'CUTTING LINK…' : 'ANON MESH · NO SIGNUP'}
      </button>
      {invite.error && <p className={css.error}>{invite.error}</p>}
    </form>
  );
}
