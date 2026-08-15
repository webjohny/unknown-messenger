/** Kawaii's icons: fat round strokes, soft corners, a heart where one fits. */

function Glyph({ children, size = 15 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
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
    <rect x="2.5" y="5.5" width="10" height="9" rx="3.5" />
    <path d="M12.5 9 17.5 6.5v7L12.5 11z" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M3 12a9 9 0 0 1 14 0l-1.5 1.8a2 2 0 0 1-2.6.3 1.6 1.6 0 0 1-.7-1.6 8 8 0 0 0-4.4 0 1.6 1.6 0 0 1-.7 1.6 2 2 0 0 1-2.6-.3z" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M12 5 7 10l5 5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M3 10.5 16.5 4l-4 13-2.5-5z" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={14}>
    <circle cx="8.8" cy="8.8" r="5" />
    <path d="M12.6 12.6 17 17" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={14}>
    <path d="M8.5 4H4.5v12h4" />
    <path d="M16 10H9" />
    <path d="M13 7l3 3-3 3" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="7.5" y="2.5" width="5" height="8.5" rx="2.5" />
    <path d="M5 9.5a5 5 0 0 0 10 0M10 15v2.5" />
    {!on && <path d="M4 4 16 16" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <rect x="2.5" y="5.5" width="10" height="9" rx="3.5" />
    <path d="M12.5 9 17.5 6.5v7L12.5 11z" />
    {!on && <path d="M3 4 17 16" />}
  </Glyph>
);

export const IconHeart = ({ size = 13 }: { size?: number }) => (
  <Glyph size={size}>
    <path d="M10 16.5S3 12.4 3 7.9A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 7 1.9c0 4.5-7 8.6-7 8.6Z" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph size={14}>
    <path d="M8.6 11.4a3 3 0 0 0 4.3 0l2.5-2.5a3 3 0 0 0-4.3-4.3l-.8.8" />
    <path d="M11.4 8.6a3 3 0 0 0-4.3 0l-2.5 2.5a3 3 0 0 0 4.3 4.3l.8-.8" />
  </Glyph>
);

export const IconFriends = () => (
  <Glyph size={14}>
    <circle cx="8" cy="7" r="3" />
    <path d="M2.5 16.5c.6-3 3-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
    <path d="M14 5.5a2.6 2.6 0 0 1 0 5" />
  </Glyph>
);
