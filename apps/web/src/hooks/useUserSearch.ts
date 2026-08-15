'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

/** Debounced user lookup for the room composer. */
export function useUserSearch(term: string, delayMs = 300) {
  const [debounced, setDebounced] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), delayMs);
    return () => clearTimeout(timer);
  }, [term, delayMs]);

  return useQuery<AuthUser[]>({
    queryKey: ['users', debounced],
    queryFn: () => api.searchUsers(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 10_000,
  });
}
