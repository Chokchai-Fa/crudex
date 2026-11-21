import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchoolLogin } from './api/school';
import { BrandLogo } from '@/components/brand-logo';
export function SchoolLogin() {
  const login = useSchoolLogin();
  const [invitation, setInvitation] = useState('');
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ credential: invitation.trim() });
          setInvitation('');
        }}
      >
        <label htmlFor="school-invite">รหัสเชิญจากโรงเรียน</label>
        <Input
          id="school-invite"
          type="password"
          autoComplete="off"
          required
          value={invitation}
          onChange={(e) => setInvitation(e.target.value)}
        />
        <Button disabled={login.isPending}>เข้าใช้พื้นที่โรงเรียน</Button>
      </form>
      {login.error && <p role="alert">{login.error.message}</p>}
    </section>
  );
}

const guestRoles = [
  {
    role: 'teacher',
    label: 'ครู',
    icon: '/team/secretary.svg',
    detail: 'คุยกับเลขาครู ทำใบงาน เก็บคะแนน และดูงานของห้องเรียน',
    scope: 'ครูตัวอย่าง · ห้องเรียนตัวอย่าง',
    action: 'เข้าใช้เป็นครู',
  },
  {
    role: 'principal',
    label: 'ผู้อำนวยการ',
    icon: '/agents/rungchao.svg',
    detail: 'รับสรุปเช้า เห็นภาพรวมระดับห้อง ไม่เห็นคะแนนรายคน',
    scope: 'ผอ. ตัวอย่าง · ทั้งโรงเรียน',
    action: 'เข้าใช้เป็น ผอ.',
  },
] as const;

export function GuestRolePicker() {
  const login = useSchoolLogin();
  return (
    <section className="role-picker">
      <BrandLogo size={46} />
      <div className="space-y-1.5 text-center">
        <h1 className="text-[32px]/10 font-bold">เข้าใช้ในฐานะ</h1>
        <p className="text-[17px] text-muted-foreground">
          เริ่มต้นด้วยโรงเรียน ห้องเรียน และนักเรียนตัวอย่างของคุณเอง
        </p>
      </div>
      <div className="role-cards">
        {guestRoles.map(({ role, label, icon, detail, scope, action }) => (
          <article key={role} className="role-card" data-role={role}>
            <img src={icon} alt="" width="72" height="72" />
            <h2 className="text-2xl font-bold">{label}</h2>
            <p className="text-base text-muted-foreground">{detail}</p>
            <p className="text-sm text-subtle-foreground">{scope}</p>
            <Button
              variant={role === 'teacher' ? 'default' : 'outline'}
              size="lg"
              disabled={login.isPending}
              onClick={() => login.mutate({ role })}
              className="mt-1 w-full text-[17px] font-bold"
            >
              {action}
            </Button>
          </article>
        ))}
      </div>
      <p className="text-sm text-subtle-foreground">
        <span className="badge-sample">ข้อมูลตัวอย่าง</span> ทุกบัญชีในเดโมเป็นข้อมูลสมมุติ
      </p>
      {login.isPending && <p role="status">กำลังเปิดพื้นที่โรงเรียน…</p>}
      {login.error && <p role="alert">{login.error.message}</p>}
    </section>
  );
}
