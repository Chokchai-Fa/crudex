import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      // Match wrangler's Text rule so skills import as strings in tests.
      name: 'markdown-text',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.md'))
          return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
});
