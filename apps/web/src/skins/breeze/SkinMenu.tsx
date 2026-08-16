import { useCallback, useEffect, useRef, useState } from 'react';

import { useSkinEngine } from '@/skin-engine';

import { IconPalette } from './icons';
import css from './breeze.module.css';

/** Distance the menu keeps from the viewport edges when it has to be nudged in. */
const EDGE_GAP = 6;
/** Matches `min-width` in the stylesheet; used before the menu has been laid out. */
const MIN_WIDTH = 210;

interface Placement {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Breeze puts the skin picker where a 2003 app would: a menu-bar drop-down.
 * Every skin draws this list itself — the engine only supplies the names.
 *
 * The menu is positioned in viewport coordinates rather than against the button:
 * on a phone the menu bar is a horizontal scroller, and a scroll container clips
 * whatever hangs out of it, so an absolutely positioned drop-down would be
 * trapped inside a 40px strip.
 */
export function SkinMenu() {
  const { skinId, skins, apply } = useSkinEngine();
  const [placement, setPlacement] = useState<Placement | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const open = placement !== null;

  const place = useCallback(() => {
    const button = trigger.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = menu.current?.offsetWidth ?? MIN_WIDTH;
    setPlacement({
      top: rect.bottom,
      left: Math.max(EDGE_GAP, Math.min(rect.left, window.innerWidth - width - EDGE_GAP)),
      // Eleven skins do not fit under the bar on a phone; the list scrolls.
      maxHeight: window.innerHeight - rect.bottom - EDGE_GAP,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!holder.current?.contains(target) && !menu.current?.contains(target)) {
        setPlacement(null);
      }
    };
    const esc = (event: KeyboardEvent) => event.key === 'Escape' && setPlacement(null);
    // Any scroll moves the button out from under the menu; re-anchoring on every
    // frame is not worth it for a menu bar, so the menu just goes away.
    const dismiss = () => setPlacement(null);

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  return (
    <div ref={holder} className={css.menuHolder}>
      <button
        ref={trigger}
        type="button"
        className={`${css.menuItem} ${open ? css.menuItemOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? setPlacement(null) : place())}
      >
        <IconPalette />
        Скіни ▾
      </button>

      {placement && (
        <div
          ref={menu}
          className={css.menu}
          role="menu"
          style={{ top: placement.top, left: placement.left, maxHeight: placement.maxHeight }}
        >
          {skins.map((skin) => (
            <button
              key={skin.id}
              type="button"
              role="menuitemradio"
              aria-checked={skin.id === skinId}
              className={css.menuOption}
              onClick={() => {
                apply(skin.id);
                setPlacement(null);
              }}
            >
              <span className={css.menuCheck}>{skin.id === skinId ? '•' : ''}</span>
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
