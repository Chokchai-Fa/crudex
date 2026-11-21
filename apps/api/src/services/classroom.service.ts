import { checkAssessment, type AssessmentContent, type SchoolActor } from '@repo/shared';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import * as repository from '../repositories/classroom.repository';
import type { Deps } from '../types/deps';
import { authorizeRunTool } from './runs.service';

export function requireClass(actor: SchoolActor, classId: string, roles: SchoolActor['role'][]) {
  if (!roles.includes(actor.role) || !actor.classes.some((c) => c.id === classId))
    throw new ForbiddenError();
}
function requireTeacher(actor: SchoolActor) {
  if (actor.role !== 'teacher') throw new ForbiddenError();
}
export async function toolScope(deps: Deps, runId: string, credential: string, agents: string[]) {
  const run = await authorizeRunTool(deps, runId, credential);
  if (!run.attemptId || !run.classId || run.role !== 'teacher' || !agents.includes(run.agentId))
    throw new ForbiddenError();
  return { schoolId: run.schoolId, classId: run.classId, runId: run.id, attemptId: run.attemptId };
}
export async function saveWorksheet(
  deps: Deps,
  runId: string,
  token: string,
  input: { assessment: AssessmentContent; invocationId: string },
) {
  const scope = await toolScope(deps, runId, token, ['jaew', 'jum']);
  const assessment = input.assessment;
  const checked = checkAssessment(assessment, { expectedCount: assessment.expectedCount });
  if (!checked.ok || checked.unverified.length)
    throw new ValidationError('The assessment contains unverified answers');
  const row = await repository.insertAssessment(deps.db, scope, input.invocationId, assessment);
  return { id: row.id, worksheetUrl: '/worksheets/' + row.id, formUrl: '/play/' + row.playToken };
}
export async function worksheet(deps: Deps, actor: SchoolActor, id: string) {
  requireTeacher(actor);
  const row = await repository.findAssessment(deps.db, actor.schoolId, id);
  if (!row) throw new NotFoundError();
  requireClass(actor, row.classId, ['teacher']);
  return { id: row.id, ...row.content, formUrl: '/play/' + row.playToken };
}
async function loadQuiz(deps: Deps, actor: SchoolActor, token: string) {
  const row = await repository.findAssessment(deps.db, actor.schoolId, token, true);
  if (!row) throw new NotFoundError();
  requireClass(actor, row.classId, ['student', 'teacher']);
  return row;
}
export async function quiz(deps: Deps, actor: SchoolActor, token: string) {
  const row = await loadQuiz(deps, actor, token);
  return {
    title: row.content.title,
    questions: row.content.questions.map(({ id, text, choices }) => ({ id, text, choices })),
  };
}
export function grade(assessment: AssessmentContent, answers: Record<string, string>) {
  if (Object.keys(answers).length !== assessment.questions.length)
    throw new ValidationError('Answer each question once');
  let score = 0;
  for (const q of assessment.questions) {
    if (!Object.hasOwn(answers, q.id) || !q.choices.some((c) => c.id === answers[q.id]))
      throw new ValidationError('Invalid quiz answer');
    if (answers[q.id] === q.correctChoiceId) score++;
  }
  return { score, maxScore: assessment.questions.length };
}
export async function submit(
  deps: Deps,
  actor: SchoolActor,
  token: string,
  answers: Record<string, string>,
) {
  if (actor.role !== 'student') throw new ForbiddenError();
  const row = await loadQuiz(deps, actor, token);
  const { score, maxScore } = grade(row.content, answers);
  const saved = await repository.recordSubmission(
    deps.db,
    row.id,
    actor.membershipId,
    answers,
    score,
    maxScore,
  );
  return { score: saved.score, maxScore: saved.maxScore };
}
export function gradebook(deps: Deps, actor: SchoolActor, id: string) {
  requireClass(actor, id, ['teacher']);
  return repository.classGradebook(deps.db, actor.schoolId, id);
}
export function nextBangkokOccurrence(hour: number, minute: number, now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  let next = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    hour - 7,
    minute,
  );
  if (next <= now.getTime()) next += 86400000;
  return new Date(next);
}
export async function routineList(deps: Deps, actor: SchoolActor) {
  requireTeacher(actor);
  return {
    routines: (await repository.listRoutines(deps.db, actor)).filter((r) =>
      actor.classes.some((c) => c.id === r.classId),
    ),
  };
}
export function schedule(
  deps: Deps,
  actor: SchoolActor,
  input: { classId: string; hour: number; minute: number },
) {
  requireClass(actor, input.classId, ['teacher']);
  return repository.createRoutine(deps.db, {
    ...input,
    teacherId: actor.membershipId,
    schoolId: actor.schoolId,
    nextRunAt: nextBangkokOccurrence(input.hour, input.minute),
  });
}
export async function updateSchedule(deps: Deps, actor: SchoolActor, id: string, enabled: boolean) {
  if (!(await routineList(deps, actor)).routines.some((r) => r.id === id))
    throw new NotFoundError();
  const row = await repository.changeRoutine(deps.db, actor, id, enabled);
  if (!row) throw new ConflictError('Routine changed');
  return row;
}
export async function reportList(deps: Deps, actor: SchoolActor) {
  if (actor.role !== 'teacher' && actor.role !== 'guardian') throw new ForbiddenError();
  return { reports: await repository.listReports(deps.db, actor) };
}
export async function brief(deps: Deps, actor: SchoolActor, date?: string) {
  if (actor.role !== 'principal') throw new ForbiddenError();
  const day = date ?? new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  return { date: day, ...(await repository.morningBrief(deps.db, actor.schoolId, day)) };
}
export async function enqueueDueReports(deps: Deps) {
  for (const row of await repository.dueRoutines(deps.db))
    await deps.queue.enqueue({
      type: 'draft-reports',
      routineId: row.id,
      occurrence: row.occurrence.toISOString(),
    });
}
export function draftReports(deps: Deps, id: string, occurrence: string) {
  return repository.draftRoutineReports(deps.db, id, occurrence);
}
export async function toolGradebook(deps: Deps, runId: string, token: string) {
  const scope = await toolScope(deps, runId, token, ['jaew', 'nun']);
  return repository.classGradebook(deps.db, scope.schoolId, scope.classId);
}
export async function principalTool(deps: Deps, runId: string, token: string, activity: boolean) {
  const run = await authorizeRunTool(deps, runId, token);
  if (run.role !== 'principal') throw new ForbiddenError();
  const date = new Date(Date.now() + 7 * 3600000 - (activity ? 86400000 : 0))
    .toISOString()
    .slice(0, 10);
  return {
    date,
    ...(activity
      ? await repository.teacherActivity(deps.db, run.schoolId, date)
      : await repository.morningBrief(deps.db, run.schoolId, date)),
  };
}
