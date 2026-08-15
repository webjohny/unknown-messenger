import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';

import './globals.css';
import { Providers } from './providers';
import { SkinHost } from './SkinHost';
import { SkinEngineProvider, SKIN_COOKIE } from '@/skin-engine';

export const metadata: Metadata = {
  title: 'Unknown Messenger',
  description: 'Відеодзвінки, чат і живі AI-субтитри',
};

// The skins pad themselves with env(safe-area-inset-*); those resolve to zero
// unless the viewport is told to extend under the notch and the home bar.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The skin owns the entire UI, so the server has to know which one before it
  // renders anything — otherwise the first paint is a different app.
  const skinId = cookies().get(SKIN_COOKIE)?.value ?? null;

  return (
    <html lang="uk">
      <body>
        <SkinEngineProvider initialSkinId={skinId}>
          <Providers>
            {/* The skin lives in the layout so that navigating between the chat
                list and a room never unmounts it. The page segments below render
                nothing; they only make the routes exist. */}
            <SkinHost />
            {children}
          </Providers>
        </SkinEngineProvider>
      </body>
    </html>
  );
}
