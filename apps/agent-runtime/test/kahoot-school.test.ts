import { Agent, type Plugin } from '@opencode/plugin';
import { CallID } from '@opencode/plugin/promise/tool';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { agents } from '../src/agents';
import { createHarness } from '../src/harness';
import type { createRuntimePlugin } from '../src/plugin';
import type { SchoolScope } from '../src/school';
import sample from './fixtures/assessment-sample.json';

vi.mock('virtual:crudex-skills', () => ({ default: [] }));
const createHost = vi.hoisted(() =>
  vi.fn<
    (options: { plugins: ReturnType<typeof createRuntimePlugin>[] }) => Promise<{
      session: { get: () => Promise<{ parentID?: string }> };
      mcp: { list: () => Promise<{ data: { name: string; status: { status: string } }[] }> };
      experimental: {
        mcp: {
          connect: (input: { server: string; location: { directory: string } }) => Promise<void>;
        };
      };
    }>
  >(),
);
vi.mock('@opencode/sdk', () => ({ OpenCode: { create: createHost } }));

type Evaluate = Parameters<Parameters<Plugin.Context['permission']['hook']>[1]>[0];
type ToolEditor = Parameters<Parameters<Plugin.Context['tool']['transform']>[0]>[0];
type ToolContext = Parameters<Parameters<ToolEditor['add']>[0]['execute']>[1];

function isSessionId(value: string): value is Evaluate['sessionID'] {
  return value.startsWith('ses');
}

function isMessageId(value: string): value is ToolContext['messageID'] {
  return value.startsWith('msg_');
}

it('registers school Kahoot and allows only jeng in a teacher session to use checked drafts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'crudex-kahoot-'));
  const url = 'https://agent.test/__kahoot/mcp';
  const token = 'fixture-sandbox-credential';
  const scope: SchoolScope = {
    schoolId: crypto.randomUUID(),
    ownerId: crypto.randomUUID(),
    classId: null,
    role: 'teacher',
    freshSession: true,
    agentId: 'jeng',
    runId: crypto.randomUUID(),
    attemptId: crypto.randomUUID(),
    expiresAt: Date.now() + 60_000,
    callbackOrigin: 'https://school.test',
    credential: crypto.randomUUID() + crypto.randomUUID(),
  };
  vi.stubEnv('SCHOOL_OWNER', scope.schoolId + '/' + scope.ownerId);
  vi.stubEnv('KAHOOT_MCP_ENABLED', 'true');
  vi.stubEnv('KAHOOT_MCP_URL', url);
  vi.stubEnv('KAHOOT_MCP_TOKEN', token);
  const set = vi.fn();
  const registered = new Map<string, Parameters<ToolEditor['add']>[0]>();
  let evaluate: ((evaluation: Evaluate) => Promise<void> | void) | undefined;
  const registration = { dispose: async () => {} };
  const list = vi.fn(async () => ({
    data: [{ name: 'crudex_kahoot', status: { status: 'failed' } }],
  }));
  const connect = vi.fn(async () => {});
  createHost.mockImplementation(async ({ plugins }) => {
    await plugins[0]?.setup({
      mcp: {
        transform: async (edit) => {
          edit({ list: () => [], get: () => undefined, set, update: vi.fn(), remove: vi.fn() });
          return registration;
        },
      },
      agent: { transform: vi.fn() },
      skill: { transform: vi.fn() },
      permission: {
        hook: async (_name, callback) => {
          evaluate = callback;
          return registration;
        },
        assert: vi.fn(),
      },
      tool: {
        transform: async (edit) => {
          edit({
            add: (tool) => registered.set(tool.name, tool),
            get: () => undefined,
            list: () => [],
            namespace: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          });
          return registration;
        },
      },
    });
    return {
      session: { get: async () => ({}) },
      mcp: { list },
      experimental: { mcp: { connect } },
    };
  });
  try {
    const { scopes, directory, prepareSchoolKahoot } = await createHarness(dir);
    expect(set).toHaveBeenCalledExactlyOnceWith('crudex_kahoot', {
      type: 'remote',
      url,
      headers: { 'x-crudex-kahoot-token': token },
      oauth: false,
      codemode: false,
    });
    await Promise.all([prepareSchoolKahoot(), prepareSchoolKahoot()]);
    expect(connect).toHaveBeenCalledExactlyOnceWith(
      { server: 'crudex_kahoot', location: { directory } },
      { signal: expect.any(AbortSignal) },
    );
    list.mockResolvedValueOnce({
      data: [{ name: 'crudex_kahoot', status: { status: 'connected' } }],
    });
    await prepareSchoolKahoot();
    expect(connect).toHaveBeenCalledOnce();
    scopes.set('ses_teacher', scope);
    scopes.set('ses_other', scope);
    scopes.set('ses_failed', scope);
    scopes.set('ses_principal', { ...scope, role: 'principal' });
    const effect = async (sessionID: string, agent: string, action: string, payload?: unknown) => {
      if (!evaluate) throw new Error('Permission handler missing');
      if (!isSessionId(sessionID)) throw new Error('Invalid session fixture');
      const evaluation: Evaluate = {
        sessionID,
        agent: Agent.ID.make(agent),
        action,
        resources: ['*'],
        effect: 'allow',
        metadata: { input: payload },
      };
      await evaluate(evaluation);
      return evaluation.effect;
    };
    const actions = [
      'crudex_kahoot_create_or_update_kahoot',
      'crudex_kahoot_get_kahoot',
      'crudex_kahoot_get_kahoot_editor_url',
    ];
    for (const action of actions) {
      for (const agent of agents.filter(({ id }) => id !== 'jeng')) {
        expect(await effect('ses_teacher', agent.id, action)).toBe('deny');
      }
      expect(await effect('ses_principal', 'jeng', action)).toBe('deny');
      expect(await effect('ses_missing', 'jeng', action)).toBe('deny');
    }
    expect(await effect('ses_teacher', 'jeng', 'crudex_kahoot_get_kahoot')).toBe('allow');
    expect(await effect('ses_teacher', 'jeng', 'crudex_kahoot_get_kahoot_editor_url')).toBe(
      'allow',
    );
    expect(await effect('ses_teacher', 'jeng', 'crudex_kahoot_publish')).toBe('deny');

    const check = registered.get('check_assessment');
    if (!check) throw new Error('Assessment checker missing');
    const runCheck = async (sessionID: string, assessment: unknown) => {
      const messageID = 'msg_fixture';
      if (!isSessionId(sessionID) || !isMessageId(messageID))
        throw new Error('Invalid check fixture');
      const result = await check.execute(assessment, {
        agent: Agent.ID.make('jeng'),
        sessionID,
        id: CallID.make('fixture-check'),
        messageID,
        signal: AbortSignal.timeout(1000),
        progress: async () => {},
      });
      if (typeof result.content !== 'string') throw new Error('Assessment result missing');
      const checked: unknown = JSON.parse(result.content);
      return checked;
    };
    const create = 'crudex_kahoot_create_or_update_kahoot';
    const failed = await runCheck('ses_failed', {
      ...sample,
      questions: sample.questions.slice(0, 1),
    });
    expect(failed).toMatchObject({ ok: false });
    expect(failed).not.toHaveProperty('kahootDraft');
    const checked = await runCheck('ses_teacher', sample);
    expect(checked).toMatchObject({ ok: true, kahootDraft: { title: sample.title } });
    if (
      typeof checked !== 'object' ||
      checked === null ||
      !('kahootDraft' in checked) ||
      typeof checked.kahootDraft !== 'object' ||
      checked.kahootDraft === null
    )
      throw new Error('Checked draft missing');
    const { kahootDraft } = checked;
    expect(await effect('ses_other', 'jeng', create, kahootDraft)).toBe('deny');
    expect(await effect('ses_teacher', 'jeng', create, { ...kahootDraft, title: 'Changed' })).toBe(
      'deny',
    );
    expect(await effect('ses_teacher', 'jeng', create, kahootDraft)).toBe('allow');
    expect(await effect('ses_teacher', 'jeng', create, kahootDraft)).toBe('deny');
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
});
