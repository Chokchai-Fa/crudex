import { expect, it } from 'vitest';
import { agents } from '../src/agents';
import { KahootDrafts, kahootTool } from '../src/kahoot-draft';
import { decide, permissionsFor } from '../src/permissions';
import sample from './fixtures/assessment-sample.json';

it('grants only jeng the one enabled Kahoot MCP action', () => {
  for (const agent of agents) {
    expect(decide(permissionsFor(agent), kahootTool, ['*'])).toBe('deny');
    const rules = permissionsFor(agent, true);
    expect(decide(rules, kahootTool, ['*'])).toBe(agent.id === 'jeng' ? 'allow' : 'deny');
    for (const action of [
      'other_create_or_update_kahoot',
      'crudex_kahoot_publish',
      'crudex_kahoot_get_kahoot',
    ]) {
      expect(decide(rules, action, ['*'])).toBe('deny');
    }
  }
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
