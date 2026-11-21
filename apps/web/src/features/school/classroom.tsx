import { Link } from '@tanstack/react-router';
import { MessageCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { SchoolAnswer } from './answer';
import { useRunEvents } from './api/run-events';

import { useSchoolGradebook, useSchoolWorksheet } from './api/school';

export const statusLabels = {
  queued: 'รอคิว',
  running: 'กำลังทำงาน',
  succeeded: 'เสร็จแล้ว',
  failed: 'ทำงานไม่สำเร็จ',
  interrupted: 'งานถูกขัดจังหวะ',
  cancelled: 'ยกเลิกแล้ว',
};
const toolStatuses = { started: 'เริ่ม', success: 'เสร็จแล้ว', failed: 'ไม่สำเร็จ' };
export function RunDetails({
  id,
  membershipId,
  status,
}: {
  id: string;
  membershipId: string;
  status: keyof typeof statusLabels;
}) {
  const active = status === 'queued' || status === 'running';
  const { events, error, loading } = useRunEvents(membershipId, id, active);
  const raw = events.flatMap((event) => (event.type === 'delta' ? [event.text] : [])).join('');
  const metadata: string[] = [];
  const text = raw
    .split(/\r?\n/)
    .filter((line) => {
      if (
        /^(?:ลิงก์:\s*\/play\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|mode:\s*school)$/i.test(
          line.trim(),
        )
      ) {
        metadata.push(line.trim());
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
  const steps = events.flatMap((event) => {
    switch (event.type) {
      case 'delta':
        return [];
      case 'status':
        return [statusLabels[event.status]];
      case 'tool':
        return [
          (event.name === 'save_assessment' ? 'บันทึกใบงาน' : event.name) +
            ' · ' +
            toolStatuses[event.status],
        ];
      case 'done':
        return ['งานเสร็จแล้ว'];
      case 'error':
        return ['งานสิ้นสุด · ' + event.code];
      case 'approval':
        return ['มีความจำที่รอครูยืนยัน'];
    }
  });
  return (
    <div className="space-y-2">
      {text ? (
        <SchoolAnswer text={text} />
      ) : (
        <p role="status">
          {loading
            ? 'กำลังอ่านคำตอบ…'
            : active
              ? statusLabels[status]
              : status === 'succeeded'
                ? 'งานเสร็จแล้ว · ไม่มีข้อความตอบกลับที่บันทึกไว้'
                : statusLabels[status]}
        </p>
      )}
      {(steps.length > 0 || metadata.length > 0) && (
        <details>
          <summary className="cursor-pointer py-2 text-sm">รายละเอียดงาน</summary>
          <ol className="list-decimal ps-5 text-sm">
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {metadata.map((line, i) => (
            <p className="break-all text-sm" key={i}>
              {line}
            </p>
          ))}
        </details>
      )}

      {error && <p role="alert">{error}</p>}
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
  return (
    <section className="space-y-2 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">สมุดคะแนนจากโรงเรียน</h2>
      {grades.error ? (
        <p role="alert">{grades.error.message}</p>
      ) : grades.data ? (
        <>
          {grades.data.students.length === 0 && <p>ยังไม่มีนักเรียนในห้องนี้</p>}
          <ul>
            {grades.data.students.map((s) => (
              <li className="flex flex-wrap justify-between gap-2 border-b py-2" key={s.id}>
                <span>{s.name}</span>
                <span>{s.score === null ? 'ยังไม่มีคะแนน' : s.score + ' / ' + s.maxScore}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p role="status">กำลังอ่านคะแนน…</p>
      )}
      <Button variant="outline" disabled={grades.isFetching} onClick={() => void grades.refetch()}>
        อ่านคะแนนอีกครั้ง
      </Button>
    </section>
  );
}
export function SchoolClassroom({ actor }: { actor: SchoolActor }) {
  const [selected, setSelected] = useState('');
  const id = actor.classes.find((c) => c.id === selected)?.id ?? actor.classes[0]?.id;
  if (!id) return <p>บัญชีนี้ยังไม่มีห้องเรียนที่ได้รับมอบหมาย</p>;
  return (
    <>
      <label className="flex items-center gap-3">
        ห้องเรียน{' '}
        <NativeSelect value={id} onChange={(e) => setSelected(e.target.value)}>
          {actor.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button asChild className="w-full sm:w-auto">
        <Link to="/teacher" search={{ roomId: id }}>
          <MessageCircle aria-hidden="true" />
          เปิดแชตกับน้องแจ๋ว
        </Link>
      </Button>
      <SchoolGradebook key={id} membershipId={actor.membershipId} classId={id} />
    </>
  );
}
