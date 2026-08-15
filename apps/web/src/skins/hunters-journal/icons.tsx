/**
 * The journal's icons: everything is drawn as if scratched into the page with
 * the same pen the entries are written with — thin strokes, round caps, no
 * fills. The pentagram doubles as the skin's bullet, so it is exported both as
 * an icon and as a standalone mark with its own size.
 */

function Glyph({
  children,
  size = 15,
  stroke = 1.5,
}: {
  children: React.ReactNode;
  size?: number;
  /* In viewBox units, so a sigil blown up to page size keeps a pen's width
     instead of scaling into a black ring. */
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  );
}

/** Devil's trap: circle + inscribed pentagram. The mark of a live contact. */
export function IconSigil({ size = 17, stroke = 1.5 }: { size?: number; stroke?: number }) {
  return (
    <Glyph size={size} stroke={stroke}>
      <circle cx="10" cy="10" r="8.4" />
      <path d="M10 2.6 12.2 8.6 18.3 8.6 13.4 12.2 15.3 18 10 14.3 4.7 18 6.6 12.2 1.7 8.6 7.8 8.6Z" />
    </Glyph>
  );
}

/**
 * The full trap drawn on the paper itself: two rings, the star, and runes on
 * the compass points. Decorative — it sits under the text at low opacity.
 */
export function IconTrap({ size, stroke = 0.2 }: { size: number | string; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <circle cx="10" cy="10" r="9.4" />
      <circle cx="10" cy="10" r="8.2" />
      <path d="M10 1.6 12.5 8.2 19.3 8.2 13.8 12.3 15.9 18.8 10 14.8 4.1 18.8 6.2 12.3 0.7 8.2 7.5 8.2Z" />
      <circle cx="10" cy="10" r="4.6" strokeDasharray="1.2 0.9" />
    </svg>
  );
}

/** A rune, used where a contact has no live sigil of its own. */
export function IconRune({ size = 15 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M6 2.8v14.4" />
      <path d="M6 5.2 13.4 9.6 6 14" />
    </Glyph>
  );
}

export const IconCall = () => (
  <Glyph>
    <path d="M4 3.4h3.2l1.3 3.3-1.9 1.4a10 10 0 0 0 4.9 4.9l1.4-1.9 3.3 1.3v3.2c0 .6-.5 1.1-1.1 1C7.9 15.9 4.1 12.1 3 4.5c-.1-.6.4-1.1 1-1.1Z" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M2.6 11.9c4-3.7 10.8-3.8 14.8.1l-1.8 1.9c-.8.8-2 .8-2.7.1-.5-.5-.6-1.2-.4-1.8a9.7 9.7 0 0 0-4.6 0c.2.6 0 1.3-.5 1.8-.7.7-1.9.6-2.6-.1Z" />
    <path d="M14.9 4.4 5.1 8.2" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M16.8 10H3.6" />
    <path d="M8.4 5 3.4 10l5 5" />
  </Glyph>
);

/** A pen nib: the send button's mark. */
export const IconSend = () => (
  <Glyph>
    <path d="M10 2.4 14.6 11 10 17.6 5.4 11Z" />
    <path d="M10 8.2v9.4" />
    <circle cx="10" cy="10.6" r="1.3" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={14}>
    <circle cx="8.6" cy="8.6" r="5.2" />
    <path d="M12.5 12.5 17 17" />
  </Glyph>
);

/** A salted doorway — the way out. */
export const IconLogout = () => (
  <Glyph size={14}>
    <path d="M8.6 3.4H4.2v13.2h4.4" />
    <path d="M17 10H8.8" />
    <path d="M13.6 6.4 17.2 10l-3.6 3.6" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph size={14}>
    <path d="M8.5 11.5c1.1 1.1 2.9 1.1 4 0l2.5-2.5c1.1-1.1 1.1-2.9 0-4s-2.9-1.1-4 0l-.9.9" />
    <path d="M11.5 8.5c-1.1-1.1-2.9-1.1-4 0L5 11c-1.1 1.1-1.1 2.9 0 4s2.9 1.1 4 0l.9-.9" />
  </Glyph>
);

export const IconPeople = () => (
  <Glyph>
    <circle cx="7.6" cy="7" r="3" />
    <path d="M2.4 16.6c.4-2.9 2.6-4.4 5.2-4.4s4.8 1.5 5.2 4.4" />
    <path d="M13.4 4.6a3 3 0 0 1 0 5.6" />
    <path d="M14.6 12.6c1.7.5 2.8 1.9 3.1 4" />
  </Glyph>
);

/** The open journal itself — the skin picker's tab. */
export const IconBook = () => (
  <Glyph>
    <path d="M10 5.4C8.4 4 6.2 3.4 2.8 3.6v11c3.4-.2 5.6.4 7.2 1.8 1.6-1.4 3.8-2 7.2-1.8v-11c-3.4-.2-5.6.4-7.2 1.8Z" />
    <path d="M10 5.4v11" />
  </Glyph>
);

export const IconMic = ({ on }: { on: boolean }) => (
  <Glyph>
    <rect x="7.4" y="2.6" width="5.2" height="9.2" rx="2.6" />
    <path d="M4.4 9.8a5.6 5.6 0 0 0 11.2 0" />
    <path d="M10 15.4v2" />
    {!on && <path d="M3.6 3.4 16.4 16.6" />}
  </Glyph>
);

export const IconCam = ({ on }: { on: boolean }) => (
  <Glyph>
    <rect x="2.6" y="5.4" width="9.4" height="9.2" rx="1.6" />
    <path d="M12 9.6 17.4 6.6v6.8L12 10.4Z" />
    {!on && <path d="M3.6 3.4 16.4 16.6" />}
  </Glyph>
);

/** The Impala on the title plate — the one decoration that is not a rune. */
export const IconCar = () => (
  <svg width="46" height="17" viewBox="0 0 46 17" aria-hidden="true" style={{ flex: 'none' }}>
    <rect x="0" y="7" width="46" height="6" rx="2.5" fill="currentColor" />
    <path d="M11 7V4.6c0-.9.7-1.6 1.6-1.6h11.8c.9 0 1.6.7 1.6 1.6V7Z" fill="currentColor" />
    <circle cx="10" cy="13" r="4" fill="#16120e" stroke="currentColor" strokeWidth="2" />
    <circle cx="36" cy="13" r="4" fill="#16120e" stroke="currentColor" strokeWidth="2" />
  </svg>
);
