import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSchoolLogin } from './api/school';
const localDemo =
  import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function SchoolLogin({ student = false }: { student?: boolean }) {
  const login = useSchoolLogin();
  const [invitation, setInvitation] = useState('');
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      {localDemo ? (
        <>
          <h2 className="text-lg font-bold">บัญชีโรงเรียนตัวอย่าง</h2>
          <p>เลือกบัญชีเพื่อเปิดข้อมูลจาก School API ในเครื่อง</p>
          <div className="flex flex-wrap gap-2">
            {student ? (
              <Button disabled={login.isPending} onClick={() => login.mutate({ role: 'student' })}>
                เข้าด้วยบัญชีนักเรียนตัวอย่าง
              </Button>
            ) : (
              <>
                <Button
                  disabled={login.isPending}
                  onClick={() => login.mutate({ role: 'teacher' })}
                >
                  เข้าพื้นที่ครู
                </Button>
                <Button
                  variant="outline"
                  disabled={login.isPending}
                  onClick={() => login.mutate({ role: 'principal' })}
                >
                  เข้าพื้นที่ ผอ.
                </Button>
              </>
            )}{' '}
          </div>
        </>
      ) : (
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
      )}
      {login.error && <p role="alert">{login.error.message}</p>}
    </section>
  );
}
