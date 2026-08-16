import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  useAuthController,
  useInviteAcceptController,
  useInviteController,
  useSessionController,
} from '@/core';
import { useSkinEngine } from '@/skin-engine';
import type { SkinManifest, SkinProps } from '@/skin-engine/contract';

import { ContactsPanel } from './ContactsPanel';
import { Conversation } from './Conversation';
import { SkinMenu } from './SkinMenu';
import { IconLink, IconLogout } from './icons';
import css from './breeze.module.css';

export const breezeManifest: SkinManifest = {
  id: 'breeze',
  label: 'Windows XP',
  description: 'Вікно XP: титул-бар, меню, буді-лист і «X says:»',
  scheme: 'light',
  preview: ['#1a63d6', '#dcebfc', '#ffeaf5'],
};

/**
 * Breeze's own architecture: everything lives inside one draggable-looking
 * window — chrome at the top, buddy list on the left, conversation on the
 * right, status bar at the bottom. Under it all is a desktop with a taskbar,
 * so the window has somewhere to be maximised into and minimised down to.
 */
export function BreezeSkin({ view }: SkinProps) {
  if (view.name === 'invite') return <InviteGate token={view.token} />;
  if (view.name === 'auth') return <SignOn />;

  return <Workspace view={view} />;
}

/** Where the window is: filling the desktop, sitting on it, or down in the bar. */
type WindowState = 'normal' | 'maximised' | 'minimised';

function Workspace({ view }: SkinProps) {
  const { logout } = useSessionController();
  const [state, setState] = useState<WindowState>('normal');
  const [askingToClose, setAskingToClose] = useState(false);
  // A window that went down maximised comes back maximised.
  const restoreTo = useRef<Exclude<WindowState, 'minimised'>>('normal');

  const title = view.name === 'room' ? 'Unknown Messenger — Розмова' : 'Unknown Messenger';

  const minimise = () => {
    if (state !== 'minimised') restoreTo.current = state;
    setState('minimised');
  };

  return (
    <Desktop
      tasks={[
        {
          title,
          active: state !== 'minimised',
          // The way XP does it: the button of the window you are looking at
          // puts it away, the button of a window that is away brings it back.
          select: () => (state === 'minimised' ? setState(restoreTo.current) : minimise()),
        },
      ]}
    >
      {state !== 'minimised' && (
        <div className={`${css.window} ${state === 'maximised' ? css.windowMax : ''}`}>
          <TitleBar
            title={title}
            maximised={state === 'maximised'}
            onMinimise={minimise}
            onMaximise={() =>
              setState((current) => (current === 'maximised' ? 'normal' : 'maximised'))
            }
            onClose={() => setAskingToClose(true)}
          />
          <MenuBar />

          <div className={`${css.body} ${view.name === 'room' ? css.bodyRoom : css.bodyList}`}>
            <div className={css.sidebar}>
              <ContactsPanel activeRoomId={view.name === 'room' ? view.roomId : undefined} />
            </div>

            {view.name === 'room' ? (
              <Conversation roomId={view.roomId} />
            ) : (
              <div className={css.main}>
                <div className={css.empty}>Оберіть співрозмовника зі списку контактів</div>
              </div>
            )}
          </div>

          <StatusBar />
        </div>
      )}

      {askingToClose && (
        <ConfirmExit onCancel={() => setAskingToClose(false)} onConfirm={logout} />
      )}
    </Desktop>
  );
}

interface Task {
  title: string;
  active: boolean;
  select: () => void;
}

/** The wallpaper, whatever window is open on it, and the bar along the bottom. */
function Desktop({ children, tasks = [] }: { children: ReactNode; tasks?: Task[] }) {
  return (
    <div className={css.desktop}>
      <div className={css.stage}>{children}</div>
      <Taskbar tasks={tasks} />
    </div>
  );
}

function TitleBar({
  title,
  maximised,
  onMinimise,
  onMaximise,
  onClose,
}: {
  title: string;
  maximised?: boolean;
  onMinimise?: () => void;
  onMaximise?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className={css.titleBar}>
      <span className={css.titleIcon} />
      <span className={css.titleText}>{title}</span>
      <span className={css.titleButtons}>
        <button
          type="button"
          className={`${css.titleButton} ${css.titleMinimise}`}
          title="Згорнути"
          aria-label="Згорнути"
          disabled={!onMinimise}
          onClick={onMinimise}
        >
          ▁
        </button>
        <button
          type="button"
          className={`${css.titleButton} ${css.titleMaximise}`}
          title={maximised ? 'Відновити' : 'На весь екран'}
          aria-label={maximised ? 'Відновити' : 'На весь екран'}
          disabled={!onMaximise}
          onClick={onMaximise}
        >
          {maximised ? '❏' : '❐'}
        </button>
        <button
          type="button"
          className={`${css.titleButton} ${css.titleClose}`}
          title="Закрити"
          aria-label="Закрити"
          disabled={!onClose}
          onClick={onClose}
        >
          ✕
        </button>
      </span>
    </div>
  );
}

/** The XP question box: closing the messenger means signing out of it. */
function ConfirmExit({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className={css.veil}
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className={`${css.window} ${css.windowDialog}`} role="dialog" aria-modal="true">
        <TitleBar title="Unknown Messenger" onClose={onCancel} />
        <div className={css.dialogBody}>
          <span className={css.dialogIcon}>?</span>
          <p className={css.dialogText}>Ви точно хочете вийти?</p>
        </div>
        <div className={css.dialogButtons}>
          <button type="button" className={css.send} onClick={onConfirm}>
            Так
          </button>
          <button type="button" className={css.tool} onClick={onCancel}>
            Ні
          </button>
        </div>
      </div>
    </div>
  );
}

function Taskbar({ tasks }: { tasks: Task[] }) {
  return (
    <div className={css.taskbar}>
      <StartButton />
      <span className={css.taskbarRule} />

      <div className={css.tasks}>
        {tasks.map((task) => (
          <button
            key={task.title}
            type="button"
            className={`${css.task} ${task.active ? css.taskActive : ''}`}
            onClick={task.select}
          >
            <span className={css.taskIcon} />
            <span className={css.taskLabel}>{task.title}</span>
          </button>
        ))}
      </div>

      <Tray />
    </div>
  );
}

/** «Пуск»: the one place in the skin that can reach everything at once. */
function StartButton() {
  const { user, signedIn, logout } = useSessionController();
  const { skinId, skins, apply } = useSkinEngine();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={holder} className={css.startHolder}>
      <button
        type="button"
        className={`${css.start} ${open ? css.startOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={css.startOrb} />
        <span className={css.startLabel}>start</span>
      </button>

      {open && (
        <div className={css.startMenu} role="menu">
          <div className={css.startHead}>
            <span className={css.startAvatar} />
            {user ? user.displayName : 'Гість'}
          </div>

          <div className={css.startList}>
            <p className={css.startGroup}>Вигляд</p>
            {skins.map((skin) => (
              <button
                key={skin.id}
                type="button"
                role="menuitemradio"
                aria-checked={skin.id === skinId}
                className={css.startItem}
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
                {skin.id === skinId && <span className={css.startMark}>•</span>}
              </button>
            ))}
          </div>

          {signedIn && (
            <div className={css.startFoot}>
              <button
                type="button"
                className={css.startItem}
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
              >
                <IconLogout />
                Вийти з системи
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The clock is set after mount: the server's minute is not the viewer's. */
function Tray() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={css.tray}>
      <span className={css.trayLamp} />
      <span className={css.trayCard} />
      <span className={css.trayClock}>{now ?? '--:--'}</span>
    </div>
  );
}

function MenuBar() {
  const { logout, user } = useSessionController();

  return (
    <div className={css.menuBar}>
      <button type="button" className={css.menuItem}>
        File
      </button>
      <button type="button" className={css.menuItem}>
        Actions
      </button>
      <SkinMenu />
      <button type="button" className={css.menuItem}>
        Help
      </button>
      <span className={css.menuSpacer} />
      <span className={css.menuStatus}>{user ? `@${user.username}` : ''}</span>
      <button type="button" className={css.menuItem} onClick={logout}>
        <IconLogout />
        Вийти
      </button>
    </div>
  );
}

function StatusBar() {
  const { user } = useSessionController();

  return (
    <div className={css.statusBar}>
      <span className={css.statusChip}>Online</span>
      <span>{user?.displayName}</span>
      <span style={{ marginLeft: 'auto' }}>Unknown Messenger 4.7</span>
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
    <Desktop>
      <div className={`${css.window} ${css.windowNarrow}`}>
        <TitleBar title="Unknown Messenger — Запрошення" />
        <div className={css.signOn}>
          <div className={css.signOnMark}>
            <span className={css.titleIcon} />
            Unknown Messenger
          </div>

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
    </Desktop>
  );
}

function SignOn() {
  const auth = useAuthController();
  const invite = useInviteController();

  return (
    <Desktop>
      <div className={`${css.window} ${css.windowNarrow}`}>
        <TitleBar title="Unknown Messenger — Вхід" />

        <form
          className={css.signOn}
          onSubmit={(event) => {
            event.preventDefault();
            void auth.submit();
          }}
        >
          <div className={css.signOnMark}>
            <span className={css.titleIcon} />
            Unknown Messenger
          </div>

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
            <span className={css.label}>E-mail</span>
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
                <span className={css.label}>Нікнейм</span>
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
                <span className={css.label}>Ім’я для відображення</span>
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
            <span className={css.label}>Пароль</span>
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
            {auth.pending ? 'Зачекайте…' : auth.mode === 'login' ? 'Sign In' : 'Створити акаунт'}
          </button>

          <div className={css.orRule}>або</div>

          {/* No account needed: this makes a room and a link to it, nothing else. */}
          <button
            type="button"
            className={css.inviteButton}
            onClick={() => void invite.create()}
            disabled={invite.pending}
          >
            <IconLink />
            {invite.pending ? 'Створюємо…' : 'Анонімний чат без реєстрації'}
          </button>
          {invite.error && <p className={css.error}>{invite.error}</p>}

          <div className={css.menuBar} style={{ borderRadius: 4 }}>
            <SkinMenu />
            <span className={css.menuSpacer} />
            <span className={css.menuStatus}>Вигляд можна змінити будь-коли</span>
          </div>
        </form>
      </div>
    </Desktop>
  );
}
