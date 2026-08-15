'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  initials,
  useAuthController,
  useChatListController,
  useInviteAcceptController,
  useInviteController,
  useRoomController,
  useSessionController,
  useSessionSocket,
} from '@/core';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';
import { useSkinEngine } from '@/skin-engine';

import { CallDeck } from './CallDeck';
import css from './spatial-interactive.module.css';
import { seedPosition, useCanvas, type Point } from './useCanvas';

export const spatialInteractiveManifest: SkinManifest = {
  id: 'spatial-interactive',
  label: 'Spatial Interactive',
  description: 'Неонова мережа: вузли тягнуться, клік відкриває сеанс на полотні',
  scheme: 'dark',
  preview: ['#7dffb8', '#05070b', '#35e8ff'],
};

/** Ring colours cycle per node, as the mesh does in the design. */
/** Kept in step with the exit animation in the stylesheet. */
const EXIT_MS = 220;

const RINGS = ['#7dffb8', '#35e8ff', '#ff78be'];

/**
 * Spatial Interactive shares the canvas mechanic with Spatial Light — drag the
 * nodes, click one to open its session, click again to close — but renders it
 * as a neon mesh: perspective floor, glowing rings, a glass panel over the top.
 */
export function SpatialInteractiveSkin({ view }: SkinProps) {
  const canvas = useCanvas();
  const { connected } = useSessionSocket();

  return (
    <div ref={canvas.stageRef} className={css.stage}>
      <div className={css.scenery}>
        <div className={css.floor} />
        <div className={css.grid} />
        <div className={css.sweep} />
      </div>

      <div className={css.brandBar}>
        <span className={css.brand}>UNKNOWN · SPATIAL CANVAS</span>
        <span className={css.divider} />
        <span className={css.hint}>DRAG NODES TO REARRANGE · CLICK TO OPEN</span>
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
        <Mesh canvas={canvas} activeRoomId={view.name === 'room' ? view.roomId : null} />
      )}

      <div className={css.vignette} />
    </div>
  );
}

type Canvas = ReturnType<typeof useCanvas>;

function Mesh({ canvas, activeRoomId }: { canvas: Canvas; activeRoomId: string | null }) {
  const list = useChatListController();
  const router = useRouter();

  const nodes = list.chats.map((chat, index) => ({
    chat,
    ring: RINGS[index % RINGS.length],
    at: canvas.positions[chat.id] ?? seedPosition(chat.id, index),
  }));

  const panelId = '__panel';
  const panelAt = canvas.positions[panelId] ?? { x: 470, y: 96 };

  // Closing plays first and navigates after: leaving for `/` is a route
  // change, which unmounts this skin and would cut the animation short.
  const [closing, setClosing] = useState(false);

  // The skin now outlives navigation, so this flag has to be cleared whenever a
  // room opens — left set, the next panel would open already animating out.
  useEffect(() => setClosing(false), [activeRoomId]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => router.push('/'), EXIT_MS);
  };

  // Whoever transmitted last carries the aura and the running dots.
  const newestId = [...nodes]
    .filter((node) => node.chat.preview)
    .sort((a, b) => (a.chat.preview!.at < b.chat.preview!.at ? 1 : -1))[0]?.chat.id;

  return (
    <>
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
                style={{ animationDelay: `${index * 60}ms` }}
                d={linkPath(node.at, panelAt)}
                fill="none"
                strokeWidth={index === 0 ? 2 : 1.5}
                stroke={index === 0 ? 'rgba(125,255,184,.3)' : 'rgba(53,232,255,.18)'}
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
              transition:
                canvas.draggingId === node.chat.id ? 'none' : 'left .18s ease-out, top .18s ease-out',
            }}
            onPointerDown={(event) =>
              canvas.startDrag(node.chat.id, node.at, event, () =>
                isActive ? close() : node.chat.open(),
              )
            }
          >
            <div
              className={`${css.pill} ${isActive ? css.pillActive : ''} ${
                !isActive && node.chat.id === newestId ? css.pillPulse : ''
              }`}
            >
              <span
                className={`${css.avatar} ${isActive ? css.avatarActive : ''}`}
                style={{ boxShadow: `0 0 0 2px ${node.ring}, 0 0 22px ${node.ring}55, inset 0 -6px 14px rgba(0,0,0,.5)` }}
              >
                {initials(node.chat.name)}
                <span className={css.dot} style={{ background: node.ring, boxShadow: `0 0 10px ${node.ring}` }} />
              </span>
              <span>
                <span className={`${css.nodeName} ${isActive ? css.nodeNameActive : ''}`}>
                  {node.chat.name.toUpperCase()}
                </span>
                <span className={css.nodeSub}>{node.chat.subtitle.toUpperCase()}</span>
              </span>
            </div>

            {/* Last transmission from this node; the open one shows it in the
                panel instead. */}
            {!isActive && node.chat.preview && (
              <div className={css.preview}>
                {node.chat.preview.own ? 'YOU: ' : ''}
                {node.chat.preview.text}
                {node.chat.id === newestId && (
                  <span className={css.previewDots}>
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
        <p className={css.emptyHint}>NO NODES ON THE MESH</p>
      )}

      <Finder list={list} />

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

function Finder({ list }: { list: ReturnType<typeof useChatListController> }) {
  return (
    <div style={{ position: 'absolute', left: 42, bottom: 34, zIndex: 19, width: 310 }}>
      <div className={css.inputRow}>
        <input
          className={css.input}
          value={list.term}
          onChange={(event) => list.setTerm(event.target.value)}
          placeholder="scan the mesh…"
        />
      </div>

      {list.searching && (
        <div className={css.skinMenu} style={{ position: 'static', marginTop: 10, width: '100%' }}>
          {list.loadingPeople && <p className={css.note}>SCANNING…</p>}
          {!list.loadingPeople && list.people.length === 0 && <p className={css.note}>NO SIGNAL</p>}
          {list.people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={css.skinOption}
              disabled={list.opening}
              onClick={person.open}
            >
              <span className={css.swatch}>
                <span style={{ background: '#7dffb8' }} />
                <span style={{ background: '#35e8ff' }} />
              </span>
              <span>{person.name.toUpperCase()}</span>
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
        <span className={`${css.avatar} ${css.avatarActive}`}>{initials(room.title)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className={css.panelName}>{room.title.toUpperCase()}</span>
          <span className={css.panelMeta}>
            SPATIAL SESSION · {room.peer ? `@${room.peer.username}` : 'GROUP'} ·{' '}
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

      {room.inCall && <CallDeck roomId={roomId} onEnd={room.toggleCall} />}

      <div className={css.thread}>
        {room.loadingHistory && <p className={css.system}>REPLAYING BUFFER…</p>}

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
                <button type="button" className={css.callChip} onClick={room.joinCall}>
                  ◉ ПРИЄДНАТИСЬ
                </button>
              )}
            </div>
          ) : (
            <div key={message.id} className={`${css.msg} ${message.own ? css.msgOwn : ''}`}>
              <div className={css.msgMeta}>
                {message.own ? 'YOU' : message.sender.username.toUpperCase()} · {message.time}
              </div>
              <div className={css.bubble}>{message.body}</div>
            </div>
          ),
        )}

        {room.typing.length > 0 && (
          <p className={css.system}>{room.typing.join(', ').toUpperCase()} TRANSMITTING…</p>
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
          <span className={css.counter}>E2E · {room.draft.length}/512</span>
        </span>
        <button type="submit" className={css.send} disabled={!room.draft.trim()}>
          SEND
        </button>
      </form>
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
              <span>{skin.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionTools({ onReset }: { onReset: () => void }) {
  const { signedIn, logout } = useSessionController();

  return (
    <>
      <button type="button" className={css.tool} onClick={onReset}>
        RESET MESH
      </button>
      {signedIn && (
        <button type="button" className={css.tool} onClick={logout}>
          DISCONNECT
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
      <span className={css.brand}>INVITE LINK</span>
      {join.status === 'joining' ? (
        <p className={css.note}>JOINING ANON MESH…</p>
      ) : (
        <>
          <p className={css.error}>{join.error}</p>
          <button
            type="button"
            className={css.send}
            style={{ width: '100%', height: 48 }}
            onClick={() => location.assign('/')}
          >
            HOME
          </button>
        </>
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
      <span className={css.brand}>{auth.mode === 'login' ? 'JOIN THE MESH' : 'NEW NODE'}</span>

      <div className={css.tabs}>
        {(['login', 'register'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={css.tool}
            style={auth.mode === mode ? { borderColor: '#7dffb8', color: '#7dffb8' } : undefined}
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

      <button type="submit" className={css.send} style={{ width: '100%', height: 48 }} disabled={auth.pending}>
        {auth.pending ? 'LINKING…' : auth.mode === 'login' ? 'ENTER' : 'CREATE'}
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
