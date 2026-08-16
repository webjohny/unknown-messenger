import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { env } from './env';
import type { AuthTokens, AuthUser } from './types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (tokens: AuthTokens, user?: AuthUser | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  /** @returns true when a new access token was obtained. */
  refresh: () => Promise<boolean>;
}

let inFlightRefresh: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setSession: (tokens, user = null) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          ...(user ? { user } : {}),
        }),

      setUser: (user) => set({ user }),

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),

      refresh: async () => {
        // Concurrent 401s must share one refresh, or token rotation invalidates
        // the tokens of every request but the first.
        if (inFlightRefresh) return inFlightRefresh;

        const { refreshToken } = get();
        if (!refreshToken) return false;

        inFlightRefresh = (async () => {
          try {
            const response = await fetch(`${env.apiUrl}/api/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            if (!response.ok) {
              get().logout();
              return false;
            }
            const tokens = (await response.json()) as AuthTokens;
            set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
            return true;
          } finally {
            inFlightRefresh = null;
          }
        })();

        return inFlightRefresh;
      },
    }),
    { name: 'messenger.auth' },
  ),
);

/**
 * The persisted session is restored from localStorage *after* the first render,
 * so guards must wait for this before concluding the user is signed out —
 * otherwise a direct visit to a protected page bounces to the login screen.
 */
export function useAuthHydrated(): boolean {
  // Always false on the first render: the server has no localStorage, so reading
  // the store during render would both crash SSR (`persist` is undefined there)
  // and desync the client's first paint from the server HTML.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useAuthStore.persist?.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
