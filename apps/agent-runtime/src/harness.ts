import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SchoolScope } from './school';
import { OpenCode } from '@opencode/sdk';
import { resolveToolOwner } from './demo-session';
import skills from 'virtual:crudex-skills';
import additionalOpenAIModels from '../openai-models.json';
import { kahootMcpServer, readKahootConfig } from './kahoot-config';
import { createRuntimePlugin } from './plugin';
import { tools } from './tools';

export type Host = OpenCode.Interface;

export async function createHarness(dataDir: string) {
  const directory = join(dataDir, 'workspace');
  await mkdir(directory, { recursive: true });
  // The embedded OpenCode catalog predates this model. Extend the built-in
  // OpenAI provider so it retains its normal API-key and transport settings.
  await writeFile(
    join(directory, 'opencode.jsonc'),
    JSON.stringify({ providers: { openai: { models: additionalOpenAIModels } } }),
  );
  const toolCalls = new Map(tools.map(({ name }) => [name, 0]));
  const scopes = new Map<string, SchoolScope>();
  const kahoot = readKahootConfig(process.env);
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
    kahoot,
    (sessionId, agent, signal) =>
      resolveToolOwner((id) => host.session.get({ sessionID: id }, { signal }), sessionId, agent),
    process.env.SCHOOL_OWNER ? resolveScope : undefined,
  );

  const host: Host = await OpenCode.create({
    database: { path: join(dataDir, 'opencode.sqlite') },
    plugins: [plugin],
  });

  let preparingKahoot: Promise<void> | undefined;
  async function reconnectKahoot() {
    const location = { directory };
    const options = { signal: AbortSignal.timeout(8_000) };
    const { data } = await host.mcp.list({ location }, options);
    const status = data.find(({ name }) => name === kahootMcpServer)?.status.status;
    if (status === 'failed' || status === 'needs_auth') {
      await host.experimental.mcp.connect({ server: kahootMcpServer, location }, options);
    }
  }

  function prepareSchoolKahoot() {
    if (!kahoot) return;
    preparingKahoot ??= reconnectKahoot()
      .catch(() => undefined)
      .finally(() => {
        preparingKahoot = undefined;
      });
    return preparingKahoot;
  }

  return { host, directory, toolCalls, scopes, prepareSchoolKahoot };
}
