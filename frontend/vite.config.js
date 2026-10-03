import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api and /media are proxied to the Node backend (default port 3000).
const target = process.env.VITE_BACKEND || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': target,
      '/media': target,
    },
  },
});
