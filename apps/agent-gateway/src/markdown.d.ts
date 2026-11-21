// Wrangler bundles `*.md` as text (see `[[rules]]` in wrangler.toml); vitest.config.ts does the same in tests.
declare module '*.md' {
  const text: string;
  export default text;
}
