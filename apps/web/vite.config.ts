import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

const schoolOrigin = 'https://app.crudex.workers.dev';
const schoolProxy: ProxyOptions = {
  target: schoolOrigin,
  changeOrigin: true,
  secure: true,
  bypass(req) {
    const host = req.headers.host ?? '';
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) return false;
    const origin = req.headers.origin;
    const read = req.method === 'GET' || req.method === 'HEAD';
    // Validate the browser origin before translating it for the upstream Worker.
    if ((!read || origin) && origin !== 'http://' + host) return false;
    if (origin) req.headers.origin = schoolOrigin;
    const session = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('__Host-school_session='));
    delete req.headers.cookie;
    delete req.headers.authorization;
    if (session) req.headers.cookie = session;
  },
};
const proxy = { '/api/': schoolProxy };

export default defineConfig({
  plugins: [
    // Must come before react(): generates src/routeTree.gen.ts from src/routes.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy,
  },
  preview: { host: '127.0.0.1', proxy },
  build: {
    outDir: 'dist',
  },
});
