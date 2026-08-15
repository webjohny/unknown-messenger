/**
 * Breeze's own icon set: chunky 2003-era glyphs with a hard outline, drawn in
 * the skin's blues. No skin shares icons with another — the drawing is part of
 * the look, not a shared library.
 */

function Glyph({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  );
}

export const IconCall = () => (
  <Glyph>
    <rect x="1" y="4" width="9" height="8" rx="1.5" fill="#cfe2fb" />
    <path d="M10 7.2 15 5v6l-5-2.2z" fill="#cfe2fb" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <rect x="2.5" y="5.5" width="11" height="5" rx="1" fill="#ffc4ad" />
    <path d="M2.5 8.5h11" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M9.5 3.5 5 8l4.5 4.5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M1.5 8 14.5 2.5 9.5 14 7.5 9z" fill="#fff" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={13}>
    <circle cx="7" cy="7" r="4.2" fill="#fff" />
    <path d="M10.2 10.2 14 14" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={13}>
    <path d="M6 2.5H2.5v11H6" />
    <path d="M9 5.5 12.5 8 9 10.5" />
    <path d="M12.5 8H6" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="6" y="1.5" width="4" height="7.5" rx="2" fill={on ? '#cfe2fb' : '#e6e6e6'} />
    <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" />
    {!on && <path d="M2.5 2.5 13.5 13.5" stroke="#c02c0c" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="1" y="4" width="9" height="8" rx="1.5" fill={on ? '#cfe2fb' : '#e6e6e6'} />
    <path d="M10 7.2 15 5v6l-5-2.2z" fill={on ? '#cfe2fb' : '#e6e6e6'} />
    {!on && <path d="M2 2.5 14 13.5" stroke="#c02c0c" />}
  </Glyph>
);

export const IconPalette = () => (
  <Glyph size={13}>
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13c.9 0 1.5-.6 1.5-1.4 0-.7-.6-1.1-.6-1.7 0-.6.5-1.1 1.1-1.1h1.2A3.3 3.3 0 0 0 14.5 7c0-3-2.9-5.5-6.5-5.5Z" />
    <circle cx="5" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="7.5" cy="4.8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="5.6" r="0.9" fill="currentColor" stroke="none" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph size={13}>
    <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9" />
    <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.1 9.2a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
  </Glyph>
);

export const IconContacts = () => (
  <Glyph size={13}>
    <circle cx="8" cy="5.5" r="2.6" fill="#fff" />
    <path d="M2.8 14c.6-2.8 2.7-4.2 5.2-4.2s4.6 1.4 5.2 4.2" />
  </Glyph>
);
