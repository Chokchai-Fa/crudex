import { execFileSync } from 'node:child_process';
import { cp, readFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse } from 'yaml';
import { z } from 'zod';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillsDir = join(root, 'skills');
const output = join(root, 'dist', 'sandbox');
const archive = join(root, 'dist', 'app.tgz');
const require = createRequire(import.meta.url);

const skillId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const frontmatter = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

const skills = [];
for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const id = skillId.parse(entry.name);
  const path = join(skillsDir, id, 'SKILL.md');
  const source = await readFile(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Missing YAML frontmatter in ${path}`);
  const [, header, body] = match;
  const metadata = frontmatter.parse(parse(header));
  skills.push({ id, ...metadata, content: z.string().trim().min(1).parse(body) });
}

await Promise.all([rm(output, { force: true, recursive: true }), rm(archive, { force: true })]);
await build({
  absWorkingDir: root,
  entryPoints: ['src/server.ts'],
  outfile: join(output, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  mainFields: ['module', 'main'],
  minify: true,
  external: ['*.node', '@silvia-odwyer/photon-node'],
  alias: {
    'ffi-rs': './src/stubs/ffi.ts',
    '@anthropic-ai/claude-agent-sdk': './src/stubs/claude-agent.ts',
  },
  banner: {
    js: 'import { createRequire as __crudex_createRequire } from "node:module"; const require = __crudex_createRequire(import.meta.url);',
  },
  plugins: [
    {
      name: 'crudex-skills',
      setup(build) {
        build.onResolve({ filter: /^virtual:crudex-skills$/ }, ({ path }) => ({
          path,
          namespace: 'crudex-skills',
        }));
        build.onLoad({ filter: /.*/, namespace: 'crudex-skills' }, () => ({
          contents: JSON.stringify(skills),
          loader: 'json',
        }));
      },
    },
  ],
  logLevel: 'error',
});

// Photon loads its WebAssembly file relative to its installed module at runtime.
const photon = '@silvia-odwyer/photon-node';
await cp(dirname(require.resolve(photon)), join(output, 'node_modules', photon), {
  recursive: true,
  dereference: true,
});
execFileSync('tar', ['-czf', archive, '-C', output, '.'], { stdio: 'inherit' });
console.log('Built apps/agent-runtime/dist/app.tgz');
