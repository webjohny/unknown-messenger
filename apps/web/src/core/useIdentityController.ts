import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 32;

/**
 * The same whitelist the server enforces (UpdateDisplayNameDto), repeated here
 * only so a bad name is refused while it is being typed. The server's copy is
 * the one that decides — this one can be walked around with a curl call.
 */
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} _.'ʼ’-]*$/u;

export interface IdentityController {
  /** The saved name — what everyone else currently sees. */
  name: string;
  /** What is in the input right now. */
  draft: string;
  setDraft: (value: string) => void;
  /** Sends the draft, unless it is unchanged, invalid or already in flight. */
  save: () => void;
  /** Puts the saved name back into the input, e.g. on Escape. */
  cancel: () => void;
  pending: boolean;
  error: string | null;
  /** Whether the draft differs from the saved name. */
  dirty: boolean;
  /**
   * Only a guest renames itself from inside the chat: a registered account
   * already picked a name when it was created.
   */
  editable: boolean;
  maxLength: number;
}

/**
 * The name an anonymous visitor arrives with is `user3737` — a number, not an
 * identity. This is the one edit that turns it into something the room can talk
 * to, and it is deliberately reachable from the thread itself: a guest has no
 * profile screen to go to and nowhere to sign back in from.
 */
export function useIdentityController(): IdentityController {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const name = user?.displayName ?? '';

  const [draft, setDraft] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The saved name can move without this input: another tab, or the session
  // arriving after the first render. Follow it rather than fight it.
  useEffect(() => setDraft(name), [name]);

  const save = () => {
    if (!user || pending) return;

    const next = normalise(draft);
    if (next === name) {
      setDraft(next);
      setError(null);
      return;
    }

    const problem = validate(next);
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    setError(null);

    void api
      .renameMe(next)
      .then((updated) => {
        setUser({ ...user, ...updated });
        setDraft(updated.displayName);
        // Names are baked into the room list and into every message already
        // fetched, so both have to be read again for the change to be visible.
        void queryClient.invalidateQueries({ queryKey: ['rooms'] });
        void queryClient.invalidateQueries({ queryKey: ['messages'] });
      })
      .catch(() => setError('Не вдалося зберегти ім’я'))
      .finally(() => setPending(false));
  };

  return {
    name,
    draft,
    setDraft: (value) => {
      // Trimming happens on save, not here: a trailing space is how a two-word
      // name gets typed.
      setDraft(value.slice(0, DISPLAY_NAME_MAX));
      setError(null);
    },
    save,
    cancel: () => {
      setDraft(name);
      setError(null);
    },
    pending,
    error,
    dirty: normalise(draft) !== name,
    editable: Boolean(user?.isGuest),
    maxLength: DISPLAY_NAME_MAX,
  };
}

/** Collapses the whitespace a name cannot meaningfully carry. */
function normalise(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function validate(value: string): string | null {
  if (value.length < DISPLAY_NAME_MIN || value.length > DISPLAY_NAME_MAX) {
    return `Ім’я — від ${DISPLAY_NAME_MIN} до ${DISPLAY_NAME_MAX} символів`;
  }
  if (!ALLOWED.test(value)) return 'Дозволені літери, цифри, пробіл і _ . -';
  return null;
}
