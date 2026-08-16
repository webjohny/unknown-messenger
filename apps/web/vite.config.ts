import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // livekit-client is by far the heaviest dependency and changes on its
        // own schedule; splitting it keeps an app-only edit from invalidating
        // half a megabyte of cache.
        manualChunks: {
          livekit: ['livekit-client', '@livekit/components-react'],
        },
      },
    },
  },
});
