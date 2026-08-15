/** HUD's icons: thin angular strokes with clipped corners, like the panels. */

function Glyph({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  );
}

export const IconCall = () => (
  <Glyph>
    <path d="M2.5 5.5h9v9h-9z" />
    <path d="M11.5 9 17.5 6v8l-6-3z" />
    <path d="M2.5 5.5 4 4h7.5" opacity="0.5" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M2.5 5.5h15v9h-15z" />
    <path d="M5.5 8.5h9v3h-9z" fill="currentColor" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M17 10H4" />
    <path d="M8.5 5.5 4 10l4.5 4.5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M2.5 10 17.5 3.5 13 17l-3.5-5.5z" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={13}>
    <path d="M9 3.5 14.5 9 9 14.5 3.5 9z" />
    <path d="M13 13l4 4" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={13}>
    <path d="M9 3H3.5v14H9" />
    <path d="M17 10H8.5" />
    <path d="M13.5 6.5 17 10l-3.5 3.5" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M7.5 2.5h5v8h-5z" fill={on ? 'currentColor' : 'none'} fillOpacity="0.35" />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
    {!on && <path d="M3.5 3.5 16.5 16.5" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M2.5 5.5h9v9h-9z" fill={on ? 'currentColor' : 'none'} fillOpacity="0.35" />
    <path d="M11.5 9 17.5 6v8l-6-3z" />
    {!on && <path d="M2.5 3.5 17.5 16.5" />}
  </Glyph>
);

export const IconSkin = () => (
  <Glyph size={13}>
    <path d="M10 2.5 17.5 10 10 17.5 2.5 10z" />
    <path d="M10 6.5 13.5 10 10 13.5 6.5 10z" fill="currentColor" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph>
    <path d="M8.5 11.5h3.5l3-3-3-3H10" />
    <path d="M11.5 8.5H8l-3 3 3 3h2" />
  </Glyph>
);

export const IconChannel = () => (
  <Glyph size={13}>
    <path d="M2.5 4.5h15v8h-9l-6 4.5z" />
  </Glyph>
);
