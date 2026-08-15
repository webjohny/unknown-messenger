'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Point {
  x: number;
  y: number;
}

/** Movement under this many pixels is a click (or a tap), not a drag. */
const CLICK_SLOP = 4;

/**
 * Opening a chat is a route change, which unmounts this skin — so the arranged
 * canvas has to survive outside React or every node would spring back to its
 * seeded spot on the way in and out of a conversation.
 */
const LAYOUT_KEY = 'spatial-light.layout';

function readLayout(): Record<string, Point> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(LAYOUT_KEY) ?? '{}') as Record<string, Point>;
  } catch {
    return {};
  }
}

/**
 * The canvas mechanic of this skin: everything on the stage is placed in stage
 * coordinates and dragged with the pointer. A press that never travels more
 * than a few pixels is reported as a click instead, which is what opens and
 * closes a node.
 *
 * Pointer events, not mouse events: a finger fires no mouse events while it
 * moves, so a mouse-only version of this leaves the whole skin unusable on a
 * phone — dragging *is* the skin. The same code now covers mouse, touch and pen.
 *
 * It lives inside the skin because it *is* the skin — no other skin has a
 * draggable stage, and the core knows nothing about where a node sits.
 */
export function useCanvas() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [positions, setPositionsState] = useState<Record<string, Point>>(readLayout);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const setPositions = useCallback(
    (update: (prev: Record<string, Point>) => Record<string, Point>) => {
      setPositionsState((prev) => {
        const next = update(prev);
        try {
          window.sessionStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
        } catch {
          /* a full or blocked store just means the layout is not remembered */
        }
        return next;
      });
    },
    [],
  );

  const drag = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    moved: boolean;
    onClick?: () => void;
  } | null>(null);

  const toStage = useCallback((event: { clientX: number; clientY: number }): Point => {
    const box = stageRef.current?.getBoundingClientRect();
    if (!box) return { x: event.clientX, y: event.clientY };
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;

      current.moved =
        current.moved ||
        Math.abs(event.clientX - current.startX) > CLICK_SLOP ||
        Math.abs(event.clientY - current.startY) > CLICK_SLOP;

      const box = stageRef.current?.getBoundingClientRect();
      // Clamp by what is being dragged, not by a guess: on a phone a node is a
      // third of the screen, and a fixed margin lets it hang off the edge.
      const maxX = (box?.width ?? 1440) - current.width - 8;
      const maxY = (box?.height ?? 920) - current.height - 8;
      const point = toStage(event);
      const x = Math.max(8, Math.min(maxX, point.x - current.offsetX));
      const y = Math.max(70, Math.min(Math.max(70, maxY), point.y - current.offsetY));

      setPositions((prev) => ({ ...prev, [current.id]: { x, y } }));
    };

    const onUp = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;

      // A press that did not travel is the "tap to open / tap to close".
      if (!current.moved) current.onClick?.();
      drag.current = null;
      setDraggingId(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // A finger leaving the screen edge, or the OS stealing the gesture, ends it.
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [toStage, setPositions]);

  const startDrag = useCallback(
    (id: string, at: Point, event: React.PointerEvent, onClick?: () => void) => {
      try {
        // Keeps the gesture even if the finger outruns the node it started on.
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture is an optimisation; the window listeners work without it */
      }

      const point = toStage(event);
      const dragged = event.currentTarget.getBoundingClientRect();
      drag.current = {
        id,
        pointerId: event.pointerId,
        width: dragged.width,
        height: dragged.height,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: point.x - at.x,
        offsetY: point.y - at.y,
        moved: false,
        onClick,
      };
      setDraggingId(id);
    },
    [toStage],
  );

  /** Drop every hand-placed position so the seeded layout applies again. */
  const reset = useCallback(() => setPositions(() => ({})), [setPositions]);

  return { stageRef, positions, draggingId, startDrag, reset };
}

/**
 * Where a node starts before anyone drags it. Seeded from the id so a given
 * chat keeps its spot across renders and reloads, and staggered so the nodes
 * do not stack on top of each other.
 */
export function seedPosition(id: string, index: number): Point {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;

  const column = index % 2;
  return {
    x: 60 + column * 150 + (hash % 40),
    y: 150 + index * 128 + ((hash >> 5) % 30),
  };
}
