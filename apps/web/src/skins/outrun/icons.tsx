/** Synthwave's icons: hard 2px neon outlines, chevrons and triangles only. */

function Glyph({ children, size = 13 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
    <path d="M2.5 6h9v8h-9z" />
    <path d="M11.5 9.5 17.5 6.5v7l-6-3z" fill="currentColor" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M3 6h14v8H3z" />
    <path d="M6 9.5h8" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M17 10H4" />
    <path d="M9 5 4 10l5 5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M3 10 17 4l-4.5 12.5-2.5-5z" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph>
    <path d="M9 3.5 14.5 9 9 14.5 3.5 9z" />
    <path d="M13.5 13.5 17 17" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph>
    <path d="M9 3.5H3.5v13H9" />
    <path d="M17 10H8" />
    <path d="M13.5 6.5 17 10l-3.5 3.5" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M7.5 2.5h5v8h-5z" fill={on ? 'currentColor' : 'none'} />
    <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15.5v2" />
    {!on && <path d="M3.5 3.5 16.5 16.5" />}
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M2.5 6h9v8h-9z" fill={on ? 'currentColor' : 'none'} />
    <path d="M11.5 9.5 17.5 6.5v7l-6-3z" />
    {!on && <path d="M2.5 4 17.5 16" />}
  </Glyph>
);

export const IconSkin = () => (
  <Glyph>
    <path d="M10 2.5 17.5 10 10 17.5 2.5 10z" fill="currentColor" fillOpacity="0.25" />
    <path d="M10 6.5 13.5 10 10 13.5 6.5 10z" fill="currentColor" />
  </Glyph>
);

export const IconLink = () => (
  <Glyph>
    <path d="M9 11.5h3.5l3-3-3-3H12" />
    <path d="M11 8.5H7.5l-3 3 3 3H8" />
  </Glyph>
);

export const IconStation = () => (
  <Glyph>
    <path d="M10 3v14" />
    <path d="M5.5 6.5a6 6 0 0 0 0 7M14.5 6.5a6 6 0 0 1 0 7" />
    <path d="M2.5 4a10 10 0 0 0 0 12M17.5 4a10 10 0 0 1 0 12" opacity="0.6" />
  </Glyph>
);
