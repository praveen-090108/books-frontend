import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendPort = Number(process.env.FRONTEND_PORT || 5173);
const backendTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  // Serve source dependencies directly in development. This avoids stale or
  // partially-written optimizer caches preventing the local UI from starting.
  optimizeDeps: {
    noDiscovery: true,
  },
  server: {
    host: '127.0.0.1',
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/branding-assets': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
