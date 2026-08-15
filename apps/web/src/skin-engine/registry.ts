import { AeroSkin, aeroManifest } from '@/skins/aero';
import { BreezeSkin, breezeManifest } from '@/skins/breeze';
import { BrutalSkin, brutalManifest } from '@/skins/brutal';
import { HudSkin, hudManifest } from '@/skins/hud';
import { HuntersJournalSkin, huntersJournalManifest } from '@/skins/hunters-journal';
import { KawaiiSkin, kawaiiManifest } from '@/skins/kawaii';
import { OutrunSkin, outrunManifest } from '@/skins/outrun';
import { ScrapbookSkin, scrapbookManifest } from '@/skins/scrapbook';
import { SpatialInteractiveSkin, spatialInteractiveManifest } from '@/skins/spatial-interactive';
import { SpatialLightSkin, spatialLightManifest } from '@/skins/spatial-light';
import { TerminalSkin, terminalManifest } from '@/skins/terminal';

import type { SkinDefinition, SkinManifest } from './contract';

/**
 * Every skin the engine can apply. Imports are static: switching skins is
 * instant and never paints a half-loaded screen, which matters when the skin
 * *is* the entire UI. Their styles are CSS modules, so eight skins in one
 * bundle cannot bleed into each other.
 */
export const SKINS = {
  breeze: { manifest: breezeManifest, Skin: BreezeSkin },
  aero: { manifest: aeroManifest, Skin: AeroSkin },
  brutal: { manifest: brutalManifest, Skin: BrutalSkin },
  hud: { manifest: hudManifest, Skin: HudSkin },
  kawaii: { manifest: kawaiiManifest, Skin: KawaiiSkin },
  outrun: { manifest: outrunManifest, Skin: OutrunSkin },
  scrapbook: { manifest: scrapbookManifest, Skin: ScrapbookSkin },
  terminal: { manifest: terminalManifest, Skin: TerminalSkin },
  'hunters-journal': { manifest: huntersJournalManifest, Skin: HuntersJournalSkin },
  // The spatial pair is not a sidebar-and-thread messenger at all: the screen
  // is a canvas of draggable nodes (see their `useCanvas`).
  'spatial-light': { manifest: spatialLightManifest, Skin: SpatialLightSkin },
  'spatial-interactive': { manifest: spatialInteractiveManifest, Skin: SpatialInteractiveSkin },
} satisfies Record<string, SkinDefinition>;

export type SkinId = keyof typeof SKINS;

export const DEFAULT_SKIN_ID: SkinId = 'breeze';

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const SKIN_MANIFESTS: SkinManifest[] = SKIN_IDS.map((id) => SKINS[id].manifest);

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && value in SKINS;
}

/**
 * The engine's entry point for a raw parameter — a cookie, a query string, a
 * stored preference. Anything unrecognised falls back instead of throwing: a
 * bad id must never leave the user without a UI.
 */
export function resolveSkinId(param: string | null | undefined): SkinId {
  return isSkinId(param) ? param : DEFAULT_SKIN_ID;
}
