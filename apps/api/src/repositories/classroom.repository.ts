import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AssessmentContent, SchoolActor } from '@repo/shared';
import type { Db } from '../db/client';
import {
  assessments,
  submissions,
  reports,
  routines,
  guardianStudents,
  schoolMemberships,
} from '../db/schema';
import { summarizeScores } from './score-history';
import { ConflictError, ForbiddenError } from '../lib/errors';

export async function insertAssessment(
  db: Db,
  scope: { schoolId: string; classId: string; runId: string; attemptId: string },
  invocationId: string,
  content: AssessmentContent,
) {
  // Serialize publication with cancellation and terminal events. A lost lease cannot publish.
  const result = await db.execute(sql`
    with active as (
      select id, school_id, class_id from agent_runs
      where id = ${scope.runId} and attempt_id = ${scope.attemptId}
        and school_id = ${scope.schoolId} and class_id = ${scope.classId}
        and status = 'running' and lease_until > now() for update
    ), saved as (
      insert into assessments (run_id, school_id, class_id, invocation_id, content)
      select id, school_id, class_id, ${invocationId}, ${JSON.stringify(content)}::jsonb from active
      on conflict (run_id, invocation_id) do update set invocation_id = excluded.invocation_id
        where assessments.content = excluded.content
      returning id, play_token
    )
    select exists(select from active) as authorized, saved.id, saved.play_token
    from (values (1)) as sentinel(n) left join saved on true
  `);
  const row = result.rows[0];
  if (!row?.authorized) throw new ForbiddenError();
  if (!row.id) throw new ConflictError('Tool call already saved a different worksheet');
  return { id: String(row.id), playToken: String(row.play_token) };
}
export async function findAssessment(db: Db, schoolId: string, id: string, byToken = false) {
  const [row] = await db
    .select()
    .from(assessments)
    .where(
      and(
        eq(assessments.schoolId, schoolId),
        eq(byToken ? assessments.playToken : assessments.id, id),
      ),
    );
  return row;
}
export async function recordSubmission(
  db: Db,
  assessmentId: string,
  studentId: string,
  answers: Record<string, string>,
  score: number,
  maxScore: number,
) {
  const [newRow] = await db
    .insert(submissions)
    .values({ assessmentId, studentId, answers, score, maxScore })
    .onConflictDoNothing()
    .returning();
  if (newRow) return newRow;
  const [previous] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assessmentId, assessmentId),
        eq(submissions.studentId, studentId),
        sql`${submissions.answers} = ${JSON.stringify(answers)}::jsonb`,
      ),
    );
  if (!previous) throw new ConflictError('This quiz has already been submitted');
  return previous;
}
export async function classScoreHistory(db: Db, schoolId: string, classId: string) {
  // Assign class-local identifiers before joining submissions so a pupil keeps one alias across dates.
  const result = await db.execute<
    Parameters<typeof summarizeScores>[2][number] & { label: string }
  >(sql`
    with roster as (
      select m.id, 's-' || to_char(row_number() over(order by a.display_name, m.id), 'FM000000') as alias
      from class_assignments x join school_memberships m on m.id=x.membership_id and m.school_id=x.school_id
      join school_accounts a on a.id=m.owner_id
      where x.school_id=${schoolId} and x.class_id=${classId} and m.role='student'
        and (m.expires_at is null or m.expires_at>now())
    )
    select w.id as "assessmentId", w.content, to_char(w.created_at at time zone 'Asia/Bangkok','YYYY-MM-DD') as date,
      r.alias as "studentId", c.name as label, s.score, s.answers
    from assessments w join school_classes c on c.id=w.class_id and c.school_id=w.school_id
    join quiz_submissions s on s.assessment_id=w.id join roster r on r.id=s.student_id
    where w.school_id=${schoolId} and w.class_id=${classId}
    order by w.created_at,w.id,r.alias`);
  return summarizeScores(classId, result.rows[0]?.label ?? '', result.rows);
}
export async function classGradebook(db: Db, schoolId: string, classId: string) {
  const [works, students] = await Promise.all([
    db
      .select({
        id: assessments.id,
        title: sql<string>`${assessments.content}->>'title'`,
        playToken: assessments.playToken,
      })
      .from(assessments)
      .where(and(eq(assessments.schoolId, schoolId), eq(assessments.classId, classId)))
      .orderBy(desc(assessments.createdAt)),
    db.execute<{ id: string; name: string; score: number | null; maxScore: number | null }>(sql`
      SELECT m.id, a.display_name AS name, SUM(s.score)::int AS score, SUM(s.max_score)::int AS "maxScore"
      FROM class_assignments x JOIN school_memberships m ON m.id=x.membership_id JOIN school_accounts a ON a.id=m.owner_id
      LEFT JOIN quiz_submissions s ON s.student_id=m.id AND s.assessment_id IN
        (SELECT id FROM assessments WHERE class_id=${classId} AND school_id=${schoolId})
      WHERE x.school_id=${schoolId} AND x.class_id=${classId} AND m.role='student' AND (m.expires_at IS NULL OR m.expires_at>now())
      GROUP BY m.id,a.display_name ORDER BY a.display_name,m.id`),
  ]);
  return {
    classId,
    students: students.rows,
    assessments: works.map((w) => ({
      id: w.id,
      title: w.title,
      worksheetUrl: '/worksheets/' + w.id,
      formUrl: '/play/' + w.playToken,
    })),
  };
}
export function listRoutines(db: Db, actor: SchoolActor) {
  return db
    .select()
    .from(routines)
    .where(and(eq(routines.schoolId, actor.schoolId), eq(routines.teacherId, actor.membershipId)))
    .orderBy(routines.hour, routines.minute);
}
export async function createRoutine(
  db: Db,
  scope: {
    schoolId: string;
    teacherId: string;
    classId: string;
    hour: number;
    minute: number;
    nextRunAt: Date;
  },
) {
  const [row] = await db.insert(routines).values(scope).onConflictDoNothing().returning();
  if (!row) throw new ConflictError('This routine already exists');
  return row;
}
export async function changeRoutine(db: Db, actor: SchoolActor, id: string, enabled: boolean) {
  const [row] = await db
    .update(routines)
    .set({
      enabled,
      nextRunAt: sql`
    (date_trunc('day',now() at time zone 'Asia/Bangkok') + make_interval(hours => hour, mins => minute)
      + CASE WHEN (now() at time zone 'Asia/Bangkok')::time >= make_time(hour,minute,0) THEN interval '1 day' ELSE interval '0' END)
    AT TIME ZONE 'Asia/Bangkok'`,
    })
    .where(
      and(
        eq(routines.id, id),
        eq(routines.schoolId, actor.schoolId),
        eq(routines.teacherId, actor.membershipId),
      ),
    )
    .returning();
  return row;
}
export async function listReports(db: Db, actor: SchoolActor) {
  const linkedStudents = db
    .select({ id: guardianStudents.studentMembershipId })
    .from(guardianStudents)
    .innerJoin(schoolMemberships, eq(schoolMemberships.id, guardianStudents.studentMembershipId))
    .where(
      and(
        eq(guardianStudents.guardianMembershipId, actor.membershipId),
        eq(schoolMemberships.role, 'student'),
        or(isNull(schoolMemberships.expiresAt), sql`${schoolMemberships.expiresAt} > now()`),
        eq(guardianStudents.schoolId, actor.schoolId),
      ),
    );
  const visible =
    actor.role === 'guardian'
      ? and(
          eq(reports.guardianId, actor.membershipId),
          eq(reports.status, 'sent'),
          inArray(reports.studentId, linkedStudents),
        )
      : and(
          eq(routines.teacherId, actor.membershipId),
          inArray(
            routines.classId,
            actor.classes.map((c) => c.id),
          ),
        );
  return db
    .select({
      id: reports.id,
      studentName: reports.studentName,
      subject: reports.subject,
      body: reports.body,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(routines, eq(routines.id, reports.routineId))
    .where(and(eq(routines.schoolId, actor.schoolId), visible))
    .orderBy(desc(reports.createdAt))
    .limit(200);
}
export async function dueRoutines(db: Db) {
  return db
    .select({ id: routines.id, occurrence: routines.nextRunAt })
    .from(routines)
    .where(and(eq(routines.enabled, true), sql`${routines.nextRunAt} <= now()`))
    .orderBy(routines.nextRunAt)
    .limit(100);
}
export async function draftRoutineReports(db: Db, id: string, occurrence: string) {
  // One statement claims the occurrence and writes its per-child drafts atomically.
  await db.execute(sql`WITH due AS (
    UPDATE school_routines r SET next_run_at=next_run_at+interval '1 day'
    WHERE r.id=${id} AND enabled AND next_run_at=${occurrence}::timestamptz AND next_run_at<=now()
    RETURNING r.*
  ) INSERT INTO guardian_reports (routine_id,occurrence,student_id,guardian_id,student_name,subject,body)
    SELECT d.id,${occurrence}::timestamptz,s.id,g.id,a.display_name,'รายงานผลการเรียน',
      a.display_name || ' · ' || COALESCE(SUM(q.score)::text || '/' || SUM(q.max_score)::text,'ยังไม่มีผลการส่งงาน')
    FROM due d
    JOIN class_assignments tx ON tx.membership_id=d.teacher_id AND tx.class_id=d.class_id
    JOIN school_memberships t ON t.id=tx.membership_id AND t.role='teacher' AND (t.expires_at IS NULL OR t.expires_at>now())
    JOIN class_assignments x ON x.class_id=d.class_id AND x.school_id=d.school_id
    JOIN school_memberships s ON s.id=x.membership_id AND s.role='student' AND (s.expires_at IS NULL OR s.expires_at>now())
    JOIN school_accounts a ON a.id=s.owner_id
    JOIN guardian_students gs ON gs.student_membership_id=s.id AND gs.school_id=d.school_id
    JOIN school_memberships g ON g.id=gs.guardian_membership_id AND g.role='guardian' AND (g.expires_at IS NULL OR g.expires_at>now())
    LEFT JOIN quiz_submissions q ON q.student_id=s.id AND q.created_at<=${occurrence}::timestamptz
      AND q.assessment_id IN (SELECT id FROM assessments WHERE class_id=d.class_id AND school_id=d.school_id)
    GROUP BY d.id,s.id,g.id,a.display_name ON CONFLICT DO NOTHING`);
}
export async function morningBrief(db: Db, schoolId: string, date: string) {
  const result = await db.execute<{
    classes: number;
    students: number;
    submissions: number;
    averagePercent: number | null;
    reports: number;
  }>(sql`
    WITH bounds AS (SELECT ${date}::date::timestamp AT TIME ZONE 'Asia/Bangkok' AS start),
      scored AS (SELECT s.* FROM quiz_submissions s JOIN assessments a ON a.id=s.assessment_id, bounds b
        WHERE a.school_id=${schoolId} AND s.created_at>=b.start AND s.created_at<b.start+interval '1 day')
    SELECT (SELECT count(*)::int FROM school_classes WHERE school_id=${schoolId}) AS classes,
      (SELECT count(*)::int FROM school_memberships WHERE school_id=${schoolId} AND role='student' AND (expires_at IS NULL OR expires_at>now())) AS students,
      (SELECT count(*)::int FROM scored) AS submissions,
      (SELECT round(100.0*sum(score)/nullif(sum(max_score),0))::int FROM scored) AS "averagePercent",
      (SELECT count(*)::int FROM guardian_reports r JOIN school_routines t ON t.id=r.routine_id,bounds b
        WHERE t.school_id=${schoolId} AND r.created_at>=b.start AND r.created_at<b.start+interval '1 day') AS reports`);
  return result.rows[0];
}
export async function teacherActivity(db: Db, schoolId: string, date: string) {
  const result = await db.execute<{ completedRuns: number; worksheetsCreated: number }>(sql`
    WITH bounds AS (SELECT ${date}::date::timestamp AT TIME ZONE 'Asia/Bangkok' AS start)
    SELECT (SELECT count(*)::int FROM agent_runs r,bounds b WHERE r.school_id=${schoolId}
      AND r.role='teacher' AND r.status='succeeded' AND r.created_at>=b.start AND r.created_at<b.start+interval '1 day') AS "completedRuns",
    (SELECT count(*)::int FROM assessments a,bounds b WHERE a.school_id=${schoolId}
      AND a.created_at>=b.start AND a.created_at<b.start+interval '1 day') AS "worksheetsCreated"`);
  return result.rows[0];
}
