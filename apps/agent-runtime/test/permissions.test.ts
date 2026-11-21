import { describe, expect, it } from 'vitest';
import { testAgent } from '../src/agents/test-agent';
import { decide, permissionsFor } from '../src/permissions';

describe('agent permissions', () => {
  it('allows bound tools and denies every other tool', () => {
    const rules = permissionsFor(testAgent);
    expect(decide(rules, 'server_clock', ['*'])).toBe('allow');
    expect(decide(rules, 'restricted_probe', ['*'])).toBe('deny');
    expect(decide(rules, 'shell', ['*'])).toBe('deny');
    expect(decide(rules, 'shell', [])).toBe('deny');
  });

  it('scopes skills and subagents to the definition', () => {
    const rules = permissionsFor({ ...testAgent, skills: ['example'], subagents: ['helper'] });
    expect(decide(rules, 'skill', ['example'])).toBe('allow');
    expect(decide(rules, 'subagent', ['helper'])).toBe('allow');
    expect(decide(rules, 'subagent', ['helper', 'other'])).toBe('deny');
  });

  it('uses the last matching rule and prioritizes deny over ask across resources', () => {
    const rules = [
      { action: '*', resource: '*', effect: 'deny' },
      { action: 'example', resource: 'sample.*', effect: 'ask' },
      { action: 'example', resource: 'sample.one', effect: 'allow' },
    ] as const;
    expect(decide(rules, 'example', ['sample.one'])).toBe('allow');
    expect(decide(rules, 'example', ['sample.one', 'sample.two'])).toBe('ask');
    expect(decide(rules, 'example', ['sampleXone', 'sample.two'])).toBe('deny');
  });
});
