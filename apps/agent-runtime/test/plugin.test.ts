import { Agent, type Plugin } from '@opencode/plugin';
import { expect, it, vi } from 'vitest';
import { createRuntimePlugin } from '../src/plugin';
import { tools } from '../src/tools';

type AgentEditor = Parameters<Parameters<Plugin.Context['agent']['transform']>[0]>[0];
type ToolEditor = Parameters<Parameters<Plugin.Context['tool']['transform']>[0]>[0];
type SkillEditor = Parameters<Parameters<Plugin.Context['skill']['transform']>[0]>[0];
type Evaluate = Parameters<Parameters<Plugin.Context['permission']['hook']>[1]>[0];
const registration = { dispose: async () => {} };
const definition = () => ({
  ...Agent.Info.default(Agent.ID.make('test-agent')),
  permissions: [] as { action: string; resource: string; effect: 'allow' | 'deny' | 'ask' }[],
  model: undefined as Agent.Info['model'],
  description: '',
  system: '',
});

it('registers its agents, skills and tools and enforces the binding before asserting permissions', async () => {
  const installedAgent = definition();
  const removed = vi.fn();
  const setDefault = vi.fn();
  const registeredTools = new Map<string, Parameters<ToolEditor['add']>[0]>();
  const addSkill = vi.fn();
  const assert = vi.fn<Plugin.Context['permission']['assert']>().mockResolvedValue(undefined);
  let evaluate: ((evaluation: Evaluate) => Promise<void> | void) | undefined;
  const increment = vi.fn(() => 1);
  const plugin = createRuntimePlugin(increment, [
    { id: 'sample', name: 'sample', description: 'An example', content: 'Sample instructions.' },
  ]);

  await plugin.setup({
    agent: {
      transform: async (edit) => {
        const editor: AgentEditor = {
          list: () => [],
          get: () => undefined,
          remove: removed,
          default: setDefault,
          update: (_id, update) => update(installedAgent),
        };
        edit(editor);
        return registration;
      },
    },
    tool: {
      transform: async (edit) => {
        edit({
          add: (tool) => registeredTools.set(tool.name, tool),
          get: () => undefined,
          list: () => [],
          namespace: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
        });
        return registration;
      },
    },
    skill: {
      transform: async (edit) => {
        const editor: SkillEditor = {
          add: addSkill,
          get: () => undefined,
          list: () => [],
          update: vi.fn(),
          remove: vi.fn(),
        };
        edit(editor);
        return registration;
      },
    },
    permission: {
      assert,
      hook: async (_name, callback) => {
        evaluate = callback;
        return registration;
      },
    },
  });

  expect(removed.mock.calls.flat()).toEqual(['build', 'plan', 'general', 'explore']);
  expect(setDefault).toHaveBeenCalledWith('jaew');
  expect(installedAgent.model).toMatchObject({ providerID: 'openai', id: 'gpt-5.4-mini' });
  expect(installedAgent.permissions).toContainEqual({
    action: 'server_clock',
    resource: '*',
    effect: 'allow',
  });
  expect(addSkill).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'sample', content: 'Sample instructions.' }),
  );
  expect([...registeredTools.keys()]).toEqual(tools.map((tool) => tool.name));
  const clock = registeredTools.get('server_clock');
  const probe = registeredTools.get('restricted_probe');
  if (!clock || !probe || !evaluate) throw new Error('Incomplete plugin registration');
  expect(clock.options).toEqual({ codemode: false });
  expect(probe.options).toEqual({ codemode: false });

  type Call = Parameters<typeof clock.execute>[1];
  const call = {
    agent: Agent.ID.make('test-agent'),
    sessionID: 'ses_test',
  } as Call;
  const evaluation: Evaluate = {
    sessionID: call.sessionID,
    agent: call.agent,
    action: 'restricted_probe',
    resources: ['*'],
    effect: 'allow',
  };
  await evaluate(evaluation);
  expect(evaluation.effect).toBe('deny');

  await expect(probe.execute({}, call)).rejects.toMatchObject({ code: 'tool_not_bound' });
  await expect(
    clock.execute({}, { ...call, agent: Agent.ID.make('unknown') }),
  ).rejects.toMatchObject({
    code: 'tool_not_bound',
  });
  expect(assert).not.toHaveBeenCalled();
  expect(increment).not.toHaveBeenCalled();

  assert.mockRejectedValueOnce(new Error('denied'));
  await expect(clock.execute({}, call)).rejects.toThrow('denied');
  expect(increment).not.toHaveBeenCalled();
  await expect(clock.execute({}, call)).resolves.toEqual({
    content: expect.stringContaining('"count":1'),
  });
  expect(assert).toHaveBeenCalledWith({
    agent: call.agent,
    sessionID: call.sessionID,
    action: 'server_clock',
    resources: ['*'],
  });
  expect(increment).toHaveBeenCalledExactlyOnceWith('server_clock');
});
