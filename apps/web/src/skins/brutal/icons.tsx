/** Brutal's icons: 3px strokes, square caps, no curves that can be avoided. */

function Glyph({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
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
    <path d="M3 5h10v10H3z" />
    <path d="M13 8.5 17 6v8l-4-2.5z" fill="currentColor" />
  </Glyph>
);

export const IconHangUp = () => (
  <Glyph>
    <path d="M4 6h12v8H4z" fill="currentColor" />
  </Glyph>
);

export const IconBack = () => (
  <Glyph>
    <path d="M16 10H4" />
    <path d="M8 5 3 10l5 5" />
  </Glyph>
);

export const IconSend = () => (
  <Glyph>
    <path d="M3 10h13" />
    <path d="M11 5l5 5-5 5" />
  </Glyph>
);

export const IconSearch = () => (
  <Glyph size={15}>
    <path d="M4 4h9v9H4z" />
    <path d="M13 13l4 4" />
  </Glyph>
);

export const IconLogout = () => (
  <Glyph size={15}>
    <path d="M9 3H3v14h6" />
    <path d="M17 10H8" />
    <path d="M13 6l4 4-4 4" />
  </Glyph>
);

export const IconMic = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M7 3h6v8H7z" fill={on ? 'currentColor' : 'none'} />
    <path d="M4 10a6 6 0 0 0 12 0" />
    <path d="M10 16v2" />
  </Glyph>
);

export const IconCam = ({ on = true }: { on?: boolean }) => (
  <Glyph>
    <path d="M3 5h10v10H3z" fill={on ? 'currentColor' : 'none'} />
    <path d="M13 8.5 17 6v8l-4-2.5z" />
  </Glyph>
);

export const IconSkin = () => (
  <Glyph size={15}>
    <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3z" />
    <path d="M11 11h6v6h-6z" fill="currentColor" />
  </Glyph>
);

export const IconThread = () => (
  <Glyph size={15}>
    <path d="M3 4h14v9H8l-5 4z" />
  </Glyph>
);
