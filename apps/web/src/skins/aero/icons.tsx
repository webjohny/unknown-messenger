/** Aero's icons: thin, round-capped, glassy — drawn only for this skin. */

function Glyph({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
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
    <rect x="2" y="5" width="11" height="10" rx="3" />
    <path d="M13 9 18 6.5v7L13 11z" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M3 12.5a9 9 0 0 1 14 0l-1.6 1.8a2 2 0 0 1-2.5.3l-1.1-.7a1.6 1.6 0 0 1-.7-1.6c-1-.3-2.2-.3-3.2 0a1.6 1.6 0 0 1-.7 1.6l-1.1.7a2 2 0 0 1-2.5-.3z" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M12 4.5 6.5 10l5.5 5.5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M2.5 10 17.5 3.5 12 17l-2.5-5.5z" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={14}>
    <circle cx="8.6" cy="8.6" r="5.1" />
    <path d="M12.4 12.4 17 17" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={14}>
    <path d="M8 3.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8" />
    <path d="M12.5 7 16 10l-3.5 3" />
    <path d="M16 10H8" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    {!on && <path d="M3.5 3.5 16.5 16.5" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="2" y="5" width="11" height="10" rx="3" />
    <path d="M13 9 18 6.5v7L13 11z" />
    {!on && <path d="M2.5 3.5 17.5 16.5" />}
  </Glyph>
);

export const IconLink = () => (
  <Glyph size={14}>
    <path d="M8.5 11.5a3.2 3.2 0 0 0 4.6 0l3-3a3.2 3.2 0 0 0-4.6-4.6l-1.1 1.1" />
    <path d="M11.5 8.5a3.2 3.2 0 0 0-4.6 0l-3 3a3.2 3.2 0 0 0 4.6 4.6l1.1-1.1" />
  </Glyph>
);

export const IconChats = () => (
  <Glyph size={14}>
    <path d="M3 5.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-4 3.5V13.5a2 2 0 0 1-1-1.7z" />
  </Glyph>
);
