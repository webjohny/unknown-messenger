/**
 * MS-DOS draws its icons the only way a text mode can: with code-page 437
 * glyphs. Vector icons would break the illusion, so this skin keeps its own
 * glyph table instead of an SVG set.
 */
export const GLYPH = {
  node: '▓',
  user: '☺',
  channel: '#',
  person: '@',
  call: '♪',
  camera: '■',
  index: '≡',
  skin: '▒',
  logout: '⌂',
  search: '?',
  link: '∞',
  send: '►',
  caption: '≈',
  cursor: '►',
  bullet: '·',
} as const;
