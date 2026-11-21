import { SchoolLogin } from '@/features/school/login';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SchoolClassroom } from '@/features/school/classroom';
import { useSchoolBrief, useSchoolLogout, useSchoolSession } from '@/features/school/api/school';

export const Route = createFileRoute('/school')({ component: School });
function Brief({ membershipId }: { membershipId: string }) {
  const brief = useSchoolBrief(membershipId);
  if (brief.error) return <p role="alert">{brief.error.message}</p>;
  if (!brief.data) return <p role="status">กำลังอ่านสรุปโรงเรียน…</p>;
  const b = brief.data;
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">สรุปเช้า · {b.date}</h2>
      <dl className="grid grid-cols-2 gap-3">
        {[
          ['ห้องเรียน', b.classes],
          ['นักเรียน', b.students],
          ['ส่งงานวันนี้', b.submissions],
          ['คะแนนเฉลี่ย', b.averagePercent === null ? 'ยังไม่มีคะแนน' : b.averagePercent + '%'],
          ['รายงานวันนี้', b.reports],
        ].map(([name, value]) => (
          <div key={name} className="rounded-xl bg-muted p-3">
            <dt>{name}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function School() {
  const session = useSchoolSession();
  const logout = useSchoolLogout();
  const me = session.data;
  return (
    <div className="school-flow mx-auto max-w-2xl space-y-5">
      <Link to="/" className="text-sm text-primary underline">
        กลับหน้าแรก
      </Link>
      <PageHeader
        title="พื้นที่โรงเรียน"
        description={me?.memberships.find((m) => m.id === me.actor.membershipId)?.schoolName}
      />
      {session.error ? (
        <div role="alert">
          {session.error.message}{' '}
          <Button variant="outline" onClick={() => void session.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : session.isPending ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : !me ? (
        <SchoolLogin />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{me.actor.displayName}</p>
            <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
              ออกจากบัญชีโรงเรียน
            </Button>
          </div>
          {logout.error && <p role="alert">{logout.error.message}</p>}
          {me.actor.role === 'teacher' ? (
            <SchoolClassroom key={me.actor.membershipId} actor={me.actor} />
          ) : me.actor.role === 'principal' ? (
            <Brief membershipId={me.actor.membershipId} />
          ) : (
            <p>พื้นที่นี้รองรับบัญชีครูและผู้อำนวยการ</p>
          )}
        </>
      )}
    </div>
  );
}
