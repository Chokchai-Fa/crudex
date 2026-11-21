import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SchoolScope } from './school';
import { OpenCode } from '@opencode/sdk';
import { resolveToolOwner } from './demo-session';
import skills from 'virtual:crudex-skills';
import { createRuntimePlugin } from './plugin';
import { tools } from './tools';

export type Host = OpenCode.Interface;

export async function createHarness(dataDir: string) {
  const directory = join(dataDir, 'workspace');
  await mkdir(directory, { recursive: true });
  const toolCalls = new Map(tools.map(({ name }) => [name, 0]));
  const scopes = new Map<string, SchoolScope>();
  async function resolveScope(sessionId: string): Promise<SchoolScope> {
    let current: string | undefined = sessionId;
    while (current) {
      const scope = scopes.get(current);
      if (scope && scope.expiresAt > Date.now()) return scope;
      current = (await host.session.get({ sessionID: current })).parentID;
    }
    throw new Error('school_scope_missing');
  }
  const plugin = createRuntimePlugin(
    (name) => {
      const count = (toolCalls.get(name) ?? 0) + 1;
      toolCalls.set(name, count);
      return count;
    },
    skills,
    !process.env.SCHOOL_OWNER && process.env.KAHOOT_MCP_ENABLED === 'true',
    (sessionId, agent, signal) =>
      resolveToolOwner((id) => host.session.get({ sessionID: id }, { signal }), sessionId, agent),
    process.env.SCHOOL_OWNER ? resolveScope : undefined,
  );

  const host: Host = await OpenCode.create({
    database: { path: join(dataDir, 'opencode.sqlite') },
    plugins: [plugin],
  });
  return { host, directory, toolCalls, scopes };
}
