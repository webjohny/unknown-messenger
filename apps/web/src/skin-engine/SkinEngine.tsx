'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { SkinManifest, SkinView } from './contract';
import { SKIN_COOKIE, SKIN_COOKIE_MAX_AGE } from './cookie';
import { DEFAULT_SKIN_ID, SKINS, SKIN_MANIFESTS, resolveSkinId, type SkinId } from './registry';

interface SkinEngineValue {
  skinId: SkinId;
  manifest: SkinManifest;
  /** Everything a skin needs to render its own skin picker, in its own style. */
  skins: SkinManifest[];
  apply: (id: string) => void;
}

const SkinEngineContext = createContext<SkinEngineValue | null>(null);

/**
 * Holds the chosen skin id. The id is mirrored into a cookie so the server
 * renders the same skin the browser will — with the skin owning the entire UI,
 * a wrong first paint is the whole screen, not a colour.
 */
export function SkinEngineProvider({
  initialSkinId,
  children,
}: {
  initialSkinId?: string | null;
  children: React.ReactNode;
}) {
  const [skinId, setSkinId] = useState<SkinId>(() => resolveSkinId(initialSkinId));

  const apply = useCallback((id: string) => {
    const next = resolveSkinId(id);
    setSkinId(next);
    document.cookie = `${SKIN_COOKIE}=${next}; path=/; max-age=${SKIN_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const value = useMemo<SkinEngineValue>(
    () => ({ skinId, manifest: SKINS[skinId].manifest, skins: SKIN_MANIFESTS, apply }),
    [skinId, apply],
  );

  return <SkinEngineContext.Provider value={value}>{children}</SkinEngineContext.Provider>;
}

export function useSkinEngine(): SkinEngineValue {
  const ctx = useContext(SkinEngineContext);
  if (!ctx) throw new Error('useSkinEngine must be used inside <SkinEngineProvider>');
  return ctx;
}

/**
 * Applies a skin: takes the view parameters plus a skin id and hands the whole
 * screen to that skin. `skinId` overrides the current selection, which is how a
 * preview or a deep link can force one specific skin.
 */
export function SkinEngine({ view, skinId }: { view: SkinView; skinId?: string }) {
  const engine = useContext(SkinEngineContext);
  const id = skinId !== undefined ? resolveSkinId(skinId) : (engine?.skinId ?? DEFAULT_SKIN_ID);
  const { Skin } = SKINS[id];

  return <Skin view={view} />;
}

