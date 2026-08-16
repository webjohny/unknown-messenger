import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import './globals.css';
import { Providers } from './providers';
import { SkinEngineProvider } from '@/skin-engine';
import { readSkinCookie } from '@/skin-engine';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      {/* The skin is chosen before the first render, not after: it owns the
          entire screen, so settling it late would flash a different app. The
          cookie is readable synchronously here, which is why nothing has to be
          rendered on a server to get this right. */}
      <SkinEngineProvider initialSkinId={readSkinCookie()}>
        <Providers>
          <App />
        </Providers>
      </SkinEngineProvider>
    </BrowserRouter>
  </StrictMode>,
);
