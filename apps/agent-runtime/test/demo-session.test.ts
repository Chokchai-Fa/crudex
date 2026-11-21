import { expect, it } from 'vitest';
import { isOwnedRoot, resolveToolOwner, validLoginId } from '../src/demo-session';
import { readBudget } from '../src/tools/read_budget';

const loginId = '5a75086c-0ab7-4b8d-841a-475f3fa239aa';
const sessions = {
  teacher: { agent: 'jaew', metadata: { crudexLoginId: loginId } },
  child: {
    agent: 'jum',
    parentID: 'teacher',
    metadata: { crudexLoginId: 'scheduled', ownerId: 'principal-demo' },
  },
  otherChild: { agent: 'lekha_por', parentID: 'teacher' },
  grandchild: { agent: 'jum', parentID: 'child' },
  principal: { agent: 'rungchao', metadata: { crudexLoginId: 'scheduled' } },
  legacy: { agent: 'jaew' },
};
const getSession = async (id: string) => sessions[id as keyof typeof sessions];

it('resumes only the same root, agent and login', () => {
  expect(isOwnedRoot(sessions.teacher, 'jaew', loginId)).toBe(true);
  expect(isOwnedRoot(sessions.teacher, 'jaew', 'another')).toBe(false);
  expect(isOwnedRoot(sessions.teacher, 'nun', loginId)).toBe(false);
  expect(isOwnedRoot(sessions.child, 'jum', 'scheduled')).toBe(false);
  expect(isOwnedRoot(sessions.legacy, 'jaew', loginId)).toBe(false);
  expect(validLoginId('scheduled', 'jaew')).toBe(false);
});

it('inherits only the server-assigned account of a legitimate direct parent', async () => {
  const teacher = { ownerId: 'teacher-demo', classId: 'class-p5-2' };
  await expect(resolveToolOwner(getSession, 'child', 'jum')).resolves.toEqual(teacher);
  await expect(resolveToolOwner(getSession, 'teacher', 'jaew')).resolves.toEqual(teacher);
  await expect(resolveToolOwner(getSession, 'principal', 'rungchao')).resolves.toEqual({
    ownerId: 'principal-demo',
  });
  await expect(resolveToolOwner(getSession, 'legacy', 'jaew')).rejects.toThrow();
  await expect(resolveToolOwner(getSession, 'principal', 'jaew')).rejects.toThrow();
  await expect(resolveToolOwner(getSession, 'otherChild', 'lekha_por')).rejects.toThrow();
  await expect(resolveToolOwner(getSession, 'grandchild', 'jum')).rejects.toThrow();
});

it('exposes only the budget assigned to each demo account', async () => {
  const context = { count: 1, signal: new AbortController().signal };
  const read = (ownerId: string) => readBudget.execute({ code: 'M-01' }, { ...context, ownerId });
  expect(await read('teacher-demo')).toMatchObject({ lines: [{ code: 'M-01' }] });
  expect(await read('principal-demo')).toMatchObject({ lines: [] });
  await expect(async () => read('other-teacher')).rejects.toThrow();
});
