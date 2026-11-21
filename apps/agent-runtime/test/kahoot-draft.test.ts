import { expect, it } from 'vitest';
import { agents } from '../src/agents';
import { readKahootConfig } from '../src/kahoot-config';
import { KahootDrafts, kahootTool } from '../src/kahoot-draft';
import { decide, permissionsFor } from '../src/permissions';
import sample from './fixtures/assessment-sample.json';

const proxy = {
  url: 'https://crudex.example/__kahoot/mcp',
  token: 'fixture-sandbox-credential',
};

it('grants the three Kahoot MCP actions only to jeng and only with configuration', () => {
  const actions = [kahootTool, 'crudex_kahoot_get_kahoot', 'crudex_kahoot_get_kahoot_editor_url'];
  for (const agent of agents) {
    for (const action of actions) {
      expect(decide(permissionsFor(agent), action, ['*'])).toBe('deny');
      expect(decide(permissionsFor(agent, proxy), action, ['*'])).toBe(
        agent.id === 'jeng' ? 'allow' : 'deny',
      );
    }
    const rules = permissionsFor(agent, proxy);
    for (const action of ['other_create_or_update_kahoot', 'crudex_kahoot_publish']) {
      expect(decide(rules, action, ['*'])).toBe('deny');
    }
  }
});

it('requires the flag, a safe proxy URL and a sandbox credential', () => {
  const env = {
    KAHOOT_MCP_ENABLED: 'true',
    KAHOOT_MCP_URL: proxy.url,
    KAHOOT_MCP_TOKEN: proxy.token,
  };
  expect(readKahootConfig(env)).toEqual(proxy);
  expect(readKahootConfig({ ...env, KAHOOT_MCP_URL: 'http://localhost:8787/mcp' })).toEqual({
    ...proxy,
    url: 'http://localhost:8787/mcp',
  });
  for (const changes of [
    { KAHOOT_MCP_ENABLED: 'false' },
    { KAHOOT_MCP_TOKEN: '' },
    { KAHOOT_MCP_URL: undefined },
    { KAHOOT_MCP_URL: 'http://crudex.example/mcp' },
    { KAHOOT_MCP_URL: 'http://localhost.example/mcp' },
    { KAHOOT_MCP_URL: '/mcp' },
  ]) {
    expect(readKahootConfig({ ...env, ...changes })).toBeUndefined();
  }
});

it('prepares a distinct image query for every question', () => {
  const payload = new KahootDrafts().check('a', sample);
  expect(payload!.questions.length).toBeGreaterThan(1);
  const queries = payload!.questions.map((question) => question.image_query);
  expect(new Set(queries).size).toBe(queries.length);
});

it('accepts only the verified, create-only payload once in its own session', () => {
  const drafts = new KahootDrafts();
  const input = { ...sample, questions: sample.questions.slice(0, 1) };
  const payload = drafts.check('a', input)!;
  expect(payload.questions[0]?.choices.filter((choice) => choice.correct)).toHaveLength(1);
  expect(drafts.consume('b', payload)).toBe(false);
  for (const changed of [
    { ...payload, uuid: 'existing' },
    { ...payload, workspaceId: 'other' },
    { ...payload, questions: [] },
    { ...payload, title: 'unverified title' },
  ]) {
    expect(drafts.consume('a', changed)).toBe(false);
  }
  expect(drafts.consume('a', structuredClone(payload))).toBe(true);
  expect(drafts.consume('a', payload)).toBe(false);
  drafts.check('a', input);
  expect(
    drafts.check('a', {
      ...input,
      questions: [{ ...input.questions[0], correctChoiceId: 'unknown' }],
    }),
  ).toBeUndefined();
  expect(drafts.consume('a', payload)).toBe(false);
});
