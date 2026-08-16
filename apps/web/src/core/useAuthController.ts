import { useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export type AuthMode = 'login' | 'register';

export interface AuthController {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  /** Every field the two modes can ask for; `register` uses all of them. */
  fields: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  };
  set: (field: keyof AuthController['fields'], value: string) => void;
  submit: () => Promise<void>;
  pending: boolean;
  error: string | null;
}

/** Login/registration logic with no opinion about how the form is laid out. */
export function useAuthController(): AuthController {
  const { setSession, setUser } = useAuthStore();

  const [mode, setModeState] = useState<AuthMode>('login');
  const [fields, setFields] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      const tokens =
        mode === 'login'
          ? await api.login({ email: fields.email, password: fields.password })
          : await api.register(fields);

      setSession(tokens);
      setUser(await api.me());
    } catch (err) {
      setError(readableError((err as Error).message));
    } finally {
      setPending(false);
    }
  };

  return {
    mode,
    setMode: (next) => {
      setModeState(next);
      setError(null);
    },
    fields,
    set: (field, value) => setFields((prev) => ({ ...prev, [field]: value })),
    submit,
    pending,
    error,
  };
}

/** The API returns raw Nest error bodies; surface the message, not the JSON. */
function readableError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON — fall through */
  }
  return raw || 'Невідома помилка';
}
