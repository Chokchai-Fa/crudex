import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OpenCode } from '@opencode/sdk';
import skills from 'virtual:crudex-skills';
import { createRuntimePlugin } from './plugin';
import { tools } from './tools';

export type Host = OpenCode.Interface;

export async function createHarness(dataDir: string) {
  const directory = join(dataDir, 'workspace');
  await mkdir(directory, { recursive: true });
  const toolCalls = new Map(tools.map(({ name }) => [name, 0]));
  const plugin = createRuntimePlugin((name) => {
    const count = (toolCalls.get(name) ?? 0) + 1;
    toolCalls.set(name, count);
    return count;
  }, skills);

  const host = await OpenCode.create({
    database: { path: join(dataDir, 'opencode.sqlite') },
    plugins: [plugin],
  });
  return { host, directory, toolCalls };
}
