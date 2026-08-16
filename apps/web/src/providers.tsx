import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { CallSessionProvider } from '@/core/call-session';
import { SessionSocketProvider } from '@/core/socket';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // A tab that comes back, or a network that returns, may have missed
            // socket events entirely — refetching is what makes the screen agree
            // with the server again.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <SessionSocketProvider>
        {/* Above the skin on purpose: a skin swap rebuilds everything below it,
            and a live call must not be part of what gets rebuilt. */}
        <CallSessionProvider>{children}</CallSessionProvider>
      </SessionSocketProvider>
    </QueryClientProvider>
  );
}
