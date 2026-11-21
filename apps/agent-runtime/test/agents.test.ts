import { describe, expect, it } from 'vitest';
import { jaew } from '../src/agents/jaew';
import { teacherAgents } from '../src/agents';
import { decide, permissionsFor } from '../src/permissions';
import { tools } from '../src/tools';

const byId = Object.fromEntries(teacherAgents.map((a) => [a.id, a]));
const toolNames = new Set(tools.map((t) => t.name));

describe('teacher agents', () => {
  it('defines the five agents with unique ids and the right modes', () => {
    expect(teacherAgents.map((a) => a.id)).toEqual(['jaew', 'jum', 'jeng', 'porn', 'nun']);
    expect(jaew.mode).toBe('primary');
    for (const id of ['jum', 'jeng', 'porn', 'nun']) expect(byId[id]?.mode).toBe('all');
  });

  it('binds only tools that exist', () => {
    for (const agent of teacherAgents)
      for (const name of agent.tools) expect(toolNames.has(name), `${agent.id}:${name}`).toBe(true);
  });

  it('lets only jaew start subagents, and only the four workers', () => {
    expect(jaew.subagents).toEqual(['jum', 'jeng', 'porn', 'nun']);
    for (const id of ['jum', 'jeng', 'porn', 'nun']) expect(byId[id]?.subagents).toEqual([]);
    const rules = permissionsFor(jaew);
    expect(decide(rules, 'subagent', ['jum'])).toBe('allow');
    expect(decide(rules, 'subagent', ['jaew'])).toBe('deny');
    expect(decide(rules, 'subagent', ['explore'])).toBe('deny');
  });

  it('denies shell, edit, web and every tool that is not bound', () => {
    for (const agent of teacherAgents) {
      const rules = permissionsFor(agent);
      for (const action of ['shell', 'edit', 'webfetch', 'websearch', 'read'])
        expect(decide(rules, action, ['*'])).toBe('deny');
      for (const tool of tools) {
        expect(decide(rules, tool.name, ['*']) !== 'deny', `${agent.id}:${tool.name}`).toBe(
          agent.tools.includes(tool.name),
        );
      }
    }
  });

  it('keeps the pieces of the demo chain apart', () => {
    const t = (id: string) => byId[id]?.tools ?? [];
    expect(t('jaew')).not.toContain('save_assessment');
    expect(t('jaew')).not.toContain('get_scores');
    expect(t('jum')).toEqual(
      expect.arrayContaining(['check_assessment', 'save_assessment', 'memory_search']),
    );
    expect(t('jum')).not.toContain('memory_save');
    expect(t('nun')).toEqual(['get_scores', 'memory_search', 'calc']);
    expect(t('porn')).toContain('send_email');
    expect(t('jeng')).toContain('check_assessment');
    expect(t('jeng')).not.toContain('get_scores');
  });

  it('only the secretary can save memory', () => {
    expect(teacherAgents.filter((a) => a.tools.includes('memory_save')).map((a) => a.id)).toEqual([
      'jaew',
    ]);
  });

  it('puts the fixed tool order in the instructions, not only in skills', () => {
    const jum = byId['jum']?.instructions ?? '';
    expect(jum.indexOf('memory_search')).toBeLessThan(jum.indexOf('check_assessment'));
    expect(jum.indexOf('check_assessment')).toBeLessThan(jum.indexOf('save_assessment'));
    expect(jaew.instructions.indexOf('ให้ผมจำไว้ไหม')).toBeLessThan(
      jaew.instructions.indexOf('ข) ถ้าเป็นคำขอให้ทำงาน'),
    );
    expect(byId['porn']?.instructions).toContain('ยืนยันทุกครั้ง');
  });

  it('gates outgoing email with ask', () => {
    expect(decide(permissionsFor(byId['porn'] as never), 'send_email', ['*'])).toBe('ask');
  });
});
