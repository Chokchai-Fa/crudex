import { Link } from '@tanstack/react-router';
import { useSchoolRuns } from './api/school';
import { useRunEvents } from './api/run-events';
import { SchoolAnswer } from './answer';
import { kahootHandoff } from './kahoot-handoff-result';
import { presentRun } from './run-presentation';
import { teacherMessage } from './worksheet-context';

export function KahootHandoff({
  id,
  membershipId,
  roomId,
}: {
  id: string;
  membershipId: string;
  roomId: string;
}) {
  const history = useSchoolRuns(membershipId, 'jaew');
  const run = history.data?.runs.find((run) => run.id === id && run.classId === roomId);
  return (
    <section
      className="my-3 grid gap-2 rounded-xl border bg-card p-4 text-sm"
      aria-label="งานที่ส่งต่อ"
    >
      <h2 className="font-semibold">งาน Kahoot ที่น้องแจ๋วส่งต่อ</h2>
      {run ? (
        <HandoffResult membershipId={membershipId} run={run} />
      ) : (
        <p role={history.isError ? 'alert' : 'status'}>
          {history.isPending
            ? 'กำลังอ่านประวัติงาน…'
            : history.isError
              ? 'อ่านประวัติงานไม่สำเร็จ'
              : 'ไม่พบงานนี้ในห้องที่เลือก'}
        </p>
      )}
      <Link
        to="/teacher"
        search={{ roomId, agentId: 'jaew' }}
        className="justify-self-start py-2 text-primary underline underline-offset-2"
      >
        กลับไปแชตน้องแจ๋ว
      </Link>
    </section>
  );
}

function HandoffResult({
  membershipId,
  run,
}: {
  membershipId: string;
  run: NonNullable<ReturnType<typeof useSchoolRuns>['data']>['runs'][number];
}) {
  const active = run.status === 'queued' || run.status === 'running';
  const { events, complete, error } = useRunEvents(membershipId, run.id, active);
  const { answer, final } = presentRun(run.status, events, complete);
  const handoff = final && kahootHandoff(events, answer);
  if (error) return <p role="alert">อ่านผลการส่งต่อไม่สำเร็จ</p>;
  if (!handoff)
    return <p role="status">{complete ? 'ไม่พบการส่งต่องาน Kahoot' : 'กำลังอ่านผลการส่งต่อ…'}</p>;
  return (
    <>
      <p className="break-words">{teacherMessage(run.prompt)}</p>
      {handoff.links.length ? (
        <SchoolAnswer text={handoff.links.map((url) => '- ' + url).join('\n')} />
      ) : (
        <p className="text-muted-foreground">
          {handoff.status === 'failed' ? 'งานที่ส่งต่อไม่สำเร็จ' : 'งานนี้ยังไม่มีลิงก์ Kahoot'}
        </p>
      )}
    </>
  );
}
