import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The first requests in a file wait for the worker and its modules to load, which can take
    // longer than Vitest's 5 s default on a cold CI runner.
    testTimeout: 30_000,
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      remoteBindings: false,
      miniflare: {
        serviceBindings: { SCHOOL_GATEWAY: () => new Response(null, { status: 503 }) },
        // Fake values so config validation passes; tests must not reach real services.
        bindings: {
          APP_ENV: 'test',
          APP_URL: 'http://localhost:5173',
          DATABASE_URL: 'postgres://test:test@db.localtest.me:5432/test',
          UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
          UPSTASH_REDIS_REST_TOKEN: 'test-token',
        },
      },
    }),
  ],
});
