import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchoolLogin } from './api/school';
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

export function GuestRolePicker() {
  const login = useSchoolLogin();
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-semibold">เลือกบทบาทเพื่อทดลองใช้</h2>
      <p className="text-muted-foreground">
        เริ่มต้นด้วยโรงเรียน ห้องเรียน และนักเรียนตัวอย่างของคุณเอง
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { role: 'teacher', label: 'ครู' },
            { role: 'principal', label: 'ผอ.' },
          ] as const
        ).map(({ role, label }) => (
          <Button
            variant="outline"
            size={null}
            key={role}
            disabled={login.isPending}
            onClick={() => login.mutate({ role })}
            className="school-role-card min-w-0 flex-col gap-2 px-2 py-4 text-base font-semibold"
          >
            <img src={'/roles/' + role + '.png'} alt="" width="72" height="72" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
      {login.isPending && <p role="status">กำลังเปิดพื้นที่โรงเรียน…</p>}
      {login.error && <p role="alert">{login.error.message}</p>}
    </section>
  );
}
