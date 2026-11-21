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
