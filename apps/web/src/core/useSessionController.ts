import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useAuthHydrated, useAuthStore } from '@/lib/auth-store';
import type { AuthUser } from '@/lib/types';

export interface SessionController {
  /** False until the persisted session has been read; skins must not decide
   *  "signed out" before this flips, or a reload bounces to the login screen. */
  ready: boolean;
  signedIn: boolean;
  user: AuthUser | null;
  logout: () => void;
}

export function useSessionController(): SessionController {
  const { accessToken, user, setUser, logout } = useAuthStore();
  const ready = useAuthHydrated();

  useEffect(() => {
    if (accessToken && !user) void api.me().then(setUser).catch(() => logout());
  }, [accessToken, user, setUser, logout]);

  return { ready, signedIn: Boolean(accessToken), user, logout };
}
