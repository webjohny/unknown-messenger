interface RuntimeConfig {
  apiUrl?: string;
  wsUrl?: string;
  livekitUrl?: string;
}

declare global {
  interface Window {
    __MESSENGER_CONFIG__?: RuntimeConfig;
  }
}

/**
 * Where the backend lives, read at runtime rather than baked in at build time.
 *
 * `public/config.js` is a plain script the container rewrites on start, so one
 * image serves every environment — staging and production are the same bytes
 * with a different first request. Vite's own `VITE_*` variables are the local
 * fallback only: they are inlined by the bundler, which is exactly the coupling
 * this indirection exists to avoid.
 */
const runtime = (typeof window === 'undefined' ? undefined : window.__MESSENGER_CONFIG__) ?? {};

export const env = {
  apiUrl: runtime.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:4000',
  wsUrl: runtime.wsUrl || import.meta.env.VITE_WS_URL || 'http://localhost:4000',
  livekitUrl: runtime.livekitUrl || import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880',
} as const;
