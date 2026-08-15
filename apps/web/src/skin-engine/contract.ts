import type { ComponentType } from 'react';

/**
 * The only thing the app tells a skin: which view to draw and with what
 * parameters. Everything else — layout, structure, internal components,
 * colours, fonts, effects — belongs to the skin and cannot be reached from
 * outside it. No `className`, no `style`, no theme tokens cross this line.
 */
export type SkinView =
  | { name: 'auth' }
  | { name: 'home' }
  | { name: 'room'; roomId: string }
  /**
   * Someone arrived on an invite link. The skin shows that it is working and
   * calls `useInviteAcceptController(token)`, which joins and redirects — the
   * only thing left for the skin to draw is the failure.
   */
  | { name: 'invite'; token: string };

export interface SkinProps {
  view: SkinView;
}

export type SkinComponent = ComponentType<SkinProps>;

export interface SkinManifest {
  id: string;
  label: string;
  /** One line describing the look, shown by skins that list the alternatives. */
  description: string;
  scheme: 'light' | 'dark';
  /** Three CSS colours a picker may show as a preview of this skin. */
  preview: [string, string, string];
}

export interface SkinDefinition {
  manifest: SkinManifest;
  Skin: SkinComponent;
}
