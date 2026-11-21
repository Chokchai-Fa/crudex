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

  it('keeps memory allow and asks a person for claims and email', () => {
    const secretary = permissionsFor(jaew);
    expect(decide(secretary, 'memory_save', ['*'])).toBe('allow');
    const budget = permissionsFor(byId['porn']!);
    expect(decide(budget, 'submit_for_approval', ['*'])).toBe('ask');
    expect(decide(budget, 'send_email', ['*'])).toBe('ask');
  });

  it('directs agents to use checked counts, verified questions and genuine tool links', () => {
    expect(byId['jum']?.instructions).toContain('ใช้ count และ topics จาก check_assessment');
    expect(byId['jum']?.instructions).toContain('ยังไม่มีไฟล์ให้ดาวน์โหลด');
    expect(byId['jeng']?.instructions).toContain('unverifiedCount เป็น 0');
    expect(byId['porn']?.instructions).toContain('ส่ง claimId เดิม');
    expect(byId['porn']?.instructions).toContain('ระบบไม่มีหน้าต่างให้กดยืนยัน');
    expect(jaew.instructions).toContain('สถานะตัวอย่าง');
  });
});

describe('jum main loop', () => {
  it('writes questions first and uses the template only after two consecutive failed checks', () => {
    const text = byId['jum']?.instructions ?? '';
    expect(text.indexOf('เขียนโจทย์เองโดยใช้ข้อมูลจากความจำและหลักสูตร')).toBeLessThan(
      text.indexOf('เรียก check_assessment'),
    );
    expect(text).toContain(
      'ใช้ fraction_addition_form เป็นทางสำรองเมื่อ check_assessment คืน ok เป็น false สองครั้งติดกันในเซสชันเดียวกันเท่านั้น',
    );
    expect(text).toContain('ห้ามเรียก fraction_addition_form ก่อนตรวจไม่ผ่านสองครั้งติดกัน');
    expect(text).toContain('ใช้แบบมาตรฐานเพราะชุดที่เขียนเองไม่ผ่านการตรวจ');
  });

  it('calls make_file only when the teacher asks for a file', () => {
    const text = byId['jum']?.instructions ?? '';
    expect(text).toContain('ห้ามเรียก make_file ในวงจรปกติ');
    expect(text.indexOf('save_assessment')).toBeLessThan(text.indexOf('make_file'));
  });
});

describe('gates for anything that leaves the system or cannot be undone', () => {
  it('asks a person for send_email, submit_for_approval and decide_approval only', () => {
    const asked = tools
      .filter((t) => t.gate === 'ask')
      .map((t) => t.name)
      .sort();
    expect(asked).toEqual([
      'decide_approval',
      'restricted_probe',
      'send_email',
      'submit_for_approval',
    ]);
  });

  it('keeps porn from submitting without the teacher pressing confirm', () => {
    const porn = byId['porn'] as never;
    expect(decide(permissionsFor(porn), 'submit_for_approval', ['*'])).toBe('ask');
    expect(byId['porn']?.instructions).toContain('กดยืนยันการส่งอีกชั้น');
  });
});

describe('model pin', () => {
  it('runs the seven teacher and principal agents on gpt-6.2-sol', async () => {
    const { principalAgents } = await import('../src/agents');
    const all = [...teacherAgents, ...principalAgents];
    expect(all).toHaveLength(7);
    for (const agent of all) expect(agent.model, agent.id).toBe('gpt-6.2-sol');
  });
});
