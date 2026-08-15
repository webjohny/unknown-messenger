/**
 * Scrapbook's icons: drawn as if with a felt pen — slightly off-straight lines
 * and round caps, so they sit with the handwriting rather than against it.
 */

function Glyph({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
    <path d="M2.6 6.2c0-.7.6-1.2 1.3-1.2h7c.7 0 1.3.5 1.2 1.2l-.1 7.6c0 .7-.6 1.2-1.3 1.2H4c-.7 0-1.3-.5-1.3-1.2z" />
    <path d="M12.2 9.6 17.4 6.4l.2 7.4-5.3-3z" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M3 12.2c3.8-3.6 10.3-3.7 14 .1l-1.7 1.8c-.7.7-1.9.8-2.6.1-.5-.5-.6-1.1-.4-1.7-1.4-.4-3-.4-4.4 0 .2.6 0 1.3-.5 1.7-.7.6-1.9.5-2.5-.2z" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M16.4 10.2 4 9.8" />
    <path d="M8.4 5.2 3.6 9.9l4.9 4.6" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M2.8 10.4 16.9 3.6l-4.2 13.1-2.6-5.2z" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={14}>
    <path d="M13.6 8.6a5 5 0 1 1-10.1.2 5 5 0 0 1 10.1-.2Z" />
    <path d="M12.6 12.4 16.8 16.9" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={14}>
    <path d="M8.6 3.6 4 3.8l.3 12.4 4.4-.2" />
    <path d="M16.4 10.1 8.6 9.9" />
    <path d="M13.2 6.8 16.6 10l-3.4 3.2" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M7.6 4.9c0-1.4 1-2.5 2.4-2.5s2.4 1.1 2.4 2.5v5.2c0 1.4-1 2.5-2.4 2.5s-2.4-1.1-2.4-2.5z" />
    <path d="M4.8 9.6c.2 3 2.5 5.1 5.3 5.1s5-2.1 5.2-5.1M10 15v2.6" />
    {!on && <path d="M3.9 3.6 16.2 16.4" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M2.6 6.2c0-.7.6-1.2 1.3-1.2h7c.7 0 1.3.5 1.2 1.2l-.1 7.6c0 .7-.6 1.2-1.3 1.2H4c-.7 0-1.3-.5-1.3-1.2z" />
    <path d="M12.2 9.6 17.4 6.4l.2 7.4-5.3-3z" />
    {!on && <path d="M2.9 3.6 17.2 16.4" />}
  </Glyph>
);

export const IconPen = ({ size = 14 }: { size?: number }) => (
  <Glyph size={size}>
    <path d="M3.4 16.6 4.3 13 13.6 3.8c.6-.6 1.5-.6 2.1 0l.6.6c.6.6.6 1.5 0 2.1L7 15.7z" />
    <path d="M12.4 5.2 15 7.8" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph size={14}>
    <path d="M8.4 11.6c1.2 1.3 3.2 1.3 4.4.1l2.6-2.5c1.3-1.2 1.3-3.2 0-4.4-1.2-1.3-3.2-1.3-4.4 0l-.9.9" />
    <path d="M11.6 8.4c-1.2-1.3-3.2-1.3-4.4 0l-2.6 2.5c-1.3 1.2-1.3 3.2 0 4.4 1.2 1.3 3.2 1.3 4.4.1l.9-.9" />
  </Glyph>
);

export const IconPeople = () => (
  <Glyph size={14}>
    <path d="M10.8 7.2a3 3 0 1 1-6 .1 3 3 0 0 1 6-.1Z" />
    <path d="M2.4 16.5c.5-2.9 2.8-4.5 5.4-4.5s4.8 1.6 5.3 4.5" />
    <path d="M13.4 5.6a2.7 2.7 0 0 1 .2 5" />
  </Glyph>
);
