import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

export default defineConfig(({ mode, command, isPreview }) => {
  const localSchool = mode === 'school-local';
  if (localSchool && (command !== 'serve' || isPreview)) {
    throw new Error('school-local is a development server mode only');
  }
  const schoolOrigin = localSchool ? 'http://127.0.0.1:8787' : 'https://app.crudex.workers.dev';
  const cookiePrefix = localSchool ? 'school_session=' : '__Host-school_session=';
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
        .find((c) => c.startsWith(cookiePrefix));
      delete req.headers.cookie;
      delete req.headers.authorization;
      if (session) req.headers.cookie = session;
    },
  };
  const proxy = { '/api/': schoolProxy };

  return {
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
  };
});
