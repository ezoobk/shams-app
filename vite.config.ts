import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function devBackendPlugin(): Plugin {
  return {
    name: 'dev-backend-server',
    apply: 'serve', // Only runs during `npm run dev`
    async configureServer() {
      try {
        const { start } = require('./scripts/dev-server.cjs');
        await start();
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.log('[Dev Server] Port 3112 is already active.');
        } else {
          console.error('[Dev Server] Failed to start isolated dev backend:', err.message);
        }
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), devBackendPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3112',
        changeOrigin: true,
      }
    }
  }
});
