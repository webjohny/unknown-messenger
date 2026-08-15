'use client';

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface CallExpansion {
  expanded: boolean;
  expand: () => void;
  collapse: () => void;
  /**
   * Spread onto a tile to make it open the overlay. A tile stays a plain
   * element — a `<button>` would drag its own box into whatever the skin drew.
   */
  tileProps: {
    role: 'button';
    tabIndex: 0;
    onClick: () => void;
    onKeyDown: (event: KeyboardEvent) => void;
  };
}

/** Whether the call is blown up over the page, and how to get in and out. */
export function useCallExpansion(): CallExpansion {
  const [expanded, setExpanded] = useState(false);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return {
    expanded,
    expand,
    collapse,
    tileProps: {
      role: 'button',
      tabIndex: 0,
      onClick: expand,
      onKeyDown: (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        expand();
      },
    },
  };
}

/**
 * The expanded call, lifted out of the conversation and onto the page itself so
 * nothing the skin laid out can clip it. It has no look of its own: `className`
 * is the skin's, and Escape or a click on the backdrop closes it.
 */
export function CallOverlay({
  className,
  onClose,
  children,
}: {
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={className}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
