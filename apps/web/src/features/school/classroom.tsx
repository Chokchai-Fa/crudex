import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import type { CreateRun, SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateSchoolRun,
  useSchoolGradebook,
  useSchoolRuns,
  useSchoolWorksheet,
} from './api/school';

const statusLabels = {
  queued: 'รอคิว',
  running: 'กำลังทำงาน',
  succeeded: 'เสร็จแล้ว',
  failed: 'ทำงานไม่สำเร็จ',
  interrupted: 'งานถูกขัดจังหวะ',
  cancelled: 'ยกเลิกแล้ว',
};
function Worksheet({ membershipId, id }: { membershipId: string; id: string }) {
  const sheet = useSchoolWorksheet(membershipId, id);
  if (sheet.error) return <p role="alert">{sheet.error.message}</p>;
  if (!sheet.data) return <p role="status">กำลังเปิดใบงาน…</p>;
  return (
    <article className="space-y-2 rounded-xl border p-4">
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
      <Button asChild variant="outline">
        <Link to="/play/$token" params={{ token: sheet.data.formUrl.split('/').pop()! }}>
          เปิดฟอร์มนักเรียน
        </Link>
      </Button>
    </article>
  );
}

function ClassWork({ membershipId, classId }: { membershipId: string; classId: string }) {
  const grades = useSchoolGradebook(membershipId, classId);
  const history = useSchoolRuns(membershipId);
  const create = useCreateSchoolRun(membershipId);
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState('');
  const retry = useRef<CreateRun | null>(null);
  async function submit() {
    const prompt = text.trim();
    if (!prompt || create.isPending) return;
    if (retry.current?.prompt !== prompt)
      retry.current = { classId, prompt, clientRequestId: crypto.randomUUID() };
    try {
      await create.mutateAsync(retry.current);
      retry.current = null;
      setText('');
    } catch {
      /* The error is shown next to the form. */
    }
  }
  return (
    <>
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-bold">งานของน้องแจ๋ว</h2>
        {import.meta.env.VITE_SCHOOL_GATEWAY_FIXTURE === 'true' && (
          <p className="text-sm text-muted-foreground">
            เซิร์ฟเวอร์ทดสอบในเครื่องใช้ผู้ช่วยจำลองที่ส่งใบงานเศษส่วนตัวอย่าง
          </p>
        )}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="school-prompt">คำขอของครู</label>
          <Textarea
            id="school-prompt"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            disabled={create.isPending}
          />
          <Button disabled={create.isPending || !text.trim()}>ส่งคำขอ</Button>
        </form>
        {create.error && <p role="alert">{create.error.message}</p>}
        {history.error ? (
          <p role="alert">{history.error.message}</p>
        ) : (
          <ul aria-live="polite" className="space-y-3">
            {history.data?.runs
              .filter((r) => r.classId === classId)
              .map((r) => (
                <li className="border-t pt-3" key={r.id}>
                  <p className="whitespace-pre-wrap break-words">{r.prompt}</p>
                  <small>{statusLabels[r.status]}</small>
                  {r.worksheetIds.map((id, i) => (
                    <Button key={id} variant="link" onClick={() => setSheet(id)}>
                      เปิดใบงาน {i + 1}
                    </Button>
                  ))}
                </li>
              ))}
          </ul>
        )}
        {sheet && (
          <>
            <Worksheet id={sheet} membershipId={membershipId} />
            <Button variant="outline" onClick={() => setSheet('')}>
              ปิดใบงาน
            </Button>
          </>
        )}
      </section>
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
        <Button
          variant="outline"
          disabled={grades.isFetching}
          onClick={() => void grades.refetch()}
        >
          อ่านคะแนนอีกครั้ง
        </Button>
      </section>
    </>
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
      <ClassWork key={id} membershipId={actor.membershipId} classId={id} />
    </>
  );
}
