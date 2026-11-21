import { Link } from '@tanstack/react-router';
import { LoaderCircle, MessageCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { AgentId, SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { SchoolAnswer } from './answer';
import { useRunEvents } from './api/run-events';
import { useRunMemory } from './api/run-memory';
import { presentRun } from './run-presentation';
import { failureLine } from './presets';

import { useSchoolGradebook, useSchoolWorksheet } from './api/school';

export const statusLabels = {
  queued: 'รอคิว',
  running: 'กำลังทำงาน',
  succeeded: 'เสร็จแล้ว',
  failed: 'ทำงานไม่สำเร็จ',
  interrupted: 'งานถูกขัดจังหวะ',
  cancelled: 'ยกเลิกแล้ว',
};
function MemoryReview({
  id,
  membershipId,
  lastProposalId,
}: {
  id: string;
  membershipId: string;
  lastProposalId: string;
}) {
  const { proposals, approve } = useRunMemory(membershipId, id, lastProposalId);
  if (proposals.isPending) return <p role="status">กำลังอ่านข้อเสนอความจำ…</p>;
  if (proposals.isError)
    return (
      <p role="alert">
        เปิดข้อเสนอความจำไม่สำเร็จ{' '}
        <Button size="sm" variant="link" onClick={() => void proposals.refetch()}>
          ลองอีกครั้ง
        </Button>
      </p>
    );
  const pending = proposals.data.proposals.filter((p) => !p.approved);
  if (!pending.length)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {proposals.data.proposals.length ? 'จดจำแล้ว' : 'ไม่มีความจำที่รอยืนยัน'}
      </p>
    );
  return (
    <>
      {pending.map((p) => (
        <section key={p.id} className="space-y-2 rounded-xl border bg-card p-3">
          <p className="text-sm font-semibold">ให้ผู้ช่วยจำเรื่องนี้ไว้ไหม?</p>
          <p>{p.text}</p>
          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
            ยืนยันให้จำ
          </Button>
        </section>
      ))}
      {approve.isError && <p role="alert">ยืนยันการจดจำไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
    </>
  );
}

export function RunDetails({
  id,
  membershipId,
  status,
  agentId,
  ack,
  onFormUrl,
  onRetry,
  retryDisabled,
}: {
  id: string;
  membershipId: string;
  status: keyof typeof statusLabels;
  /** The replying assistant, for the failed-reply wording. */
  agentId?: AgentId;
  /** Instant client-side acknowledgement shown until the first real content arrives. */
  ack?: string;
  /** Reports a Google Form link found in this reply, for the form card. */
  onFormUrl?: (url: string) => void;
  /** Sends the same request again; shown only after a failed or interrupted reply. */
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const active = status === 'queued' || status === 'running';
  const { events, error, complete } = useRunEvents(membershipId, id, active);
  const { answer, activity, notice, lastProposalId, final, phase } = presentRun(
    status,
    events,
    complete,
  );
  const failed = phase === 'failed' || phase === 'interrupted';
  const googleForm = /https:\/\/docs\.google\.com\/forms\/[^\s"'<>)\]\\]+/.exec(
    JSON.stringify(events),
  )?.[0];
  useEffect(() => {
    if (googleForm) onFormUrl?.(googleForm);
  }, [googleForm, onFormUrl]);
  const acking = !!ack && !answer && !failed && !notice && !error && !final;

  return (
    <div className="space-y-2">
      {answer && <SchoolAnswer text={answer} />}
      {acking && (
        <p className="run-ack" role="status">
          {ack}
          <span className="typing-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </p>
      )}
      {!error && activity && !(acking && /^(รอคิว|กำลังคิด)$/.test(activity)) && (
        <p className="school-run-activity" role="status">
          <LoaderCircle aria-hidden="true" />
          {activity}
        </p>
      )}
      {failed ? (
        <div className="run-failed" role="status">
          <p>{failureLine(agentId)}</p>
          {onRetry && (
            <Button size="sm" disabled={retryDisabled} onClick={onRetry}>
              ส่งอีกครั้ง
            </Button>
          )}
          {notice && <small className="w-full text-muted-foreground">{notice}</small>}
        </div>
      ) : (
        notice && (
          <p role="status" className="text-sm font-medium">
            {notice}
          </p>
        )
      )}
      {error && <p role="alert">ยังโหลดคำตอบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ</p>}
      {!answer && !activity && !notice && !error && !lastProposalId && !acking && (
        <p className="text-sm text-muted-foreground" role="status">
          {final ? 'งานเสร็จแล้ว · ไม่มีข้อความตอบกลับ' : 'กำลังอ่านคำตอบ…'}
        </p>
      )}
      {lastProposalId && (
        <MemoryReview id={id} membershipId={membershipId} lastProposalId={lastProposalId} />
      )}
    </div>
  );
}
export function Worksheet({ membershipId, id }: { membershipId: string; id: string }) {
  const sheet = useSchoolWorksheet(membershipId, id);
  if (sheet.error) return <p role="alert">{sheet.error.message}</p>;
  if (!sheet.data) return <p role="status">กำลังเปิดใบงาน…</p>;
  const questions = (
    <>
      <h3 className="font-bold">{sheet.data.title}</h3>
      <ol className="list-decimal space-y-2 ps-6">
        {sheet.data.questions.map((q) => (
          <li key={q.id}>
            {q.text}
            <ul className="list-disc ps-5">
              {q.choices.map((choice) => (
                <li key={choice.id}>{choice.text}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
  return (
    <article className="space-y-2 rounded-xl border p-4">
      {questions}
      <Button onClick={() => window.print()}>พิมพ์ใบงาน</Button>
      {createPortal(<article className="school-print-sheet">{questions}</article>, document.body)}
      <Button asChild variant="outline">
        <Link to="/play/$token" params={{ token: sheet.data.formUrl.split('/').pop()! }}>
          เปิดฟอร์มนักเรียน
        </Link>
      </Button>
    </article>
  );
}

export function SchoolGradebook({
  membershipId,
  classId,
}: {
  membershipId: string;
  classId: string;
}) {
  const grades = useSchoolGradebook(membershipId, classId);
  const students = grades.data?.students ?? [];
  const scored = students.filter((s) => s.score !== null);
  const low = scored.filter((s) => !!s.maxScore && (s.score ?? 0) / s.maxScore < 0.5);
  return (
    <section className="gradebook space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 grow space-y-0.5">
          <h2 className="text-xl font-bold">สมุดคะแนนจากโรงเรียน</h2>
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-success-text">
            <span className="availability-dot" aria-hidden="true" />
            คะแนนจากโรงเรียน
            <span className="badge-sample">ข้อมูลตัวอย่าง</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={grades.isFetching}
          onClick={() => void grades.refetch()}
        >
          อ่านคะแนนอีกครั้ง
        </Button>
      </div>
      {grades.error ? (
        <p role="alert">{grades.error.message}</p>
      ) : grades.data ? (
        <>
          <dl className="gradebook-stats">
            <div>
              <dt>มีคะแนนแล้ว</dt>
              <dd>
                {scored.length}
                <small>/{students.length} คน</small>
              </dd>
            </div>
            <div className="is-low">
              <dt>ต่ำกว่า 50%</dt>
              <dd>
                {low.length}
                <small> คน</small>
              </dd>
            </div>
          </dl>
          {students.length === 0 ? (
            <p className="gradebook-empty">ยังไม่มีนักเรียนในห้องนี้</p>
          ) : (
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th scope="col" className="w-20">
                    เลขที่
                  </th>
                  <th scope="col">ชื่อ (ตัวอย่าง)</th>
                  <th scope="col" className="text-end">
                    คะแนน
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const isLow = s.score !== null && !!s.maxScore && s.score / s.maxScore < 0.5;
                  return (
                    <tr key={s.id} className={isLow ? 'is-low' : undefined}>
                      <td className="text-subtle-foreground">{String(i + 1).padStart(2, '0')}</td>
                      <td>{s.name}</td>
                      <td className="text-end font-bold">
                        {s.score === null ? (
                          <span className="font-normal text-subtle-foreground">ยังไม่มีคะแนน</span>
                        ) : (
                          s.score + '/' + s.maxScore
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p role="status">กำลังอ่านคะแนน…</p>
      )}
    </section>
  );
}
export function SchoolClassroom({ actor }: { actor: SchoolActor }) {
  const [selected, setSelected] = useState('');
  const id = actor.classes.find((c) => c.id === selected)?.id ?? actor.classes[0]?.id;
  if (!id) return <p>บัญชีนี้ยังไม่มีห้องเรียนที่ได้รับมอบหมาย</p>;
  return (
    <>
      <div className="classroom-row">
        <label className="flex items-center gap-3 font-semibold">
          ห้องเรียน{' '}
          <NativeSelect value={id} onChange={(e) => setSelected(e.target.value)}>
            {actor.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button asChild className="w-full sm:ms-auto sm:w-auto">
          <Link to="/teacher" search={{ roomId: id }}>
            <MessageCircle aria-hidden="true" />
            เปิดแชตกับน้องแจ๋ว
          </Link>
        </Button>
      </div>
      <div className="school-panel">
        <SchoolGradebook key={id} membershipId={actor.membershipId} classId={id} />
      </div>
    </>
  );
}
