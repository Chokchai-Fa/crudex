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
  const teacher = { ownerId: 'teacher-' + loginId, classId: 'class-p5-2' };
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
  expect(await read('teacher-' + loginId)).toMatchObject({ lines: [{ code: 'M-01' }] });
  expect(await read('principal-demo')).toMatchObject({ lines: [] });
  await expect(async () => read('teacher-not-a-login')).rejects.toThrow();
  await expect(async () => read('other-teacher')).rejects.toThrow();
});

it('gives each teacher login its own account, so owner-keyed state does not mix', async () => {
  const otherLogin = '0b3c8f1e-9d2a-4c5b-8e7f-1a2b3c4d5e6f';
  const two = {
    a: { agent: 'jaew', metadata: { crudexLoginId: loginId } },
    b: { agent: 'jaew', metadata: { crudexLoginId: otherLogin } },
    scheduledTeacher: { agent: 'jaew', metadata: { crudexLoginId: 'scheduled' } },
  };
  const get = async (id: string) => two[id as keyof typeof two];
  const a = await resolveToolOwner(get, 'a', 'jaew');
  const b = await resolveToolOwner(get, 'b', 'jaew');
  expect(a.ownerId).not.toBe(b.ownerId);
  await expect(resolveToolOwner(get, 'scheduledTeacher', 'jaew')).rejects.toThrow();
});
