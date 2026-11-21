import { roles } from '@/features/school-access/roles';
import { Link } from '@tanstack/react-router';
import { logout } from '@/features/school-access/api';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Building2, Users, BookOpen, UserRoundPlus, Ticket } from 'lucide-react';
import { type AdminCommand, type AdminDirectory, type SchoolRole } from '@repo/shared';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-error';
import { directory, save } from './api';

const tasks = [
  { id: 'enroll', label: 'จัดสมาชิกเข้าห้อง', icon: UserRoundPlus },
  { id: 'invite', label: 'ออกรหัสเชิญ', icon: Ticket },
  { id: 'createAccount', label: 'สร้างบัญชี', icon: Users },
  { id: 'createClass', label: 'สร้างห้องเรียน', icon: BookOpen },
  { id: 'createSchool', label: 'สร้างโรงเรียน', icon: Building2 },
] as const;
type Task = (typeof tasks)[number]['id'];
type Option = { id: string; name: string };
function Select({
  label,
  name,
  options,
  value,
  onChange,
  showId = false,
}: {
  label: string;
  name: string;
  options: Option[];
  value?: string;
  onChange?: (v: string) => void;
  showId?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select
        name={name}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        defaultValue={value === undefined ? '' : undefined}
        required
        className="bg-background border-input h-10 w-full rounded-md border px-3"
      >
        <option value="" disabled>
          เลือก{label}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {showId ? ' · ' + o.id.slice(-8) : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function AccountAccess({ denied, onChange }: { denied: boolean; onChange: () => Promise<void> }) {
  const auth = useMutation({ mutationFn: logout, onSuccess: onChange });
  return (
    <Panel title={denied ? 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' : 'เข้าสู่ระบบผู้ดูแล'}>
      {denied ? (
        <Button variant="outline" disabled={auth.isPending} onClick={() => auth.mutate()}>
          ออกจากระบบเพื่อเปลี่ยนบัญชี
        </Button>
      ) : (
        <Button asChild>
          <Link to="/account">เข้าสู่ระบบด้วยรหัสเชิญ</Link>
        </Button>
      )}
      {auth.isError && <p role="alert">ออกจากระบบไม่สำเร็จ</p>}
    </Panel>
  );
}
function SetupForm({
  task,
  schoolId,
  data,
  refresh,
}: {
  task: Task;
  schoolId: string;
  data: AdminDirectory;
  refresh: (selected?: string) => Promise<void>;
}) {
  const [role, setRole] = useState<SchoolRole>('teacher');
  const [id, setId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async (result, c) => {
      if ('id' in result) {
        setId(crypto.randomUUID());
        await refresh(c.action === 'createSchool' ? result.id : undefined);
      }
    },
    onError: async (e) => {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) await refresh();
    },
  });
  const title = tasks.find((t) => t.id === task)!.label;
  const needsSchool = task !== 'createSchool' && task !== 'createAccount';
  if (needsSchool && !schoolId)
    return (
      <Panel title={title}>
        <p>เลือกโรงเรียนก่อน หรือสร้างโรงเรียนใหม่</p>
      </Panel>
    );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const field = (key: string) => String(fields.get(key) ?? '').trim();
    let c: AdminCommand;
    switch (task) {
      case 'createSchool':
      case 'createAccount':
        c = { action: task, id, name: field('name') };
        break;
      case 'createClass':
        c = { action: task, id, name: field('name'), schoolId };
        break;
      case 'invite':
        c = { action: task, schoolId, membershipId: field('membership') };
        break;
      case 'enroll':
        c = {
          action: task,
          schoolId,
          accountId: field('account'),
          placement:
            role === 'guardian'
              ? { role, studentMembershipId: field('student') }
              : role === 'principal'
                ? { role }
                : { role, classId: field('class') },
        };
        break;
    }
    mutation.mutate(c, {
      onSuccess: () => {
        if ('name' in c) form.reset();
      },
    });
  }
  return (
    <Panel title={title}>
      <form
        className="grid max-w-xl gap-5"
        onChange={() => {
          if (!mutation.isPending) mutation.reset();
        }}
        onSubmit={submit}
      >
        <fieldset disabled={mutation.isPending} className="grid gap-4">
          {task.startsWith('create') && (
            <label className="grid gap-2">
              {task === 'createSchool'
                ? 'ชื่อโรงเรียน'
                : task === 'createClass'
                  ? 'ชื่อห้องเรียน'
                  : 'ชื่อที่แสดง'}
              <Input name="name" required maxLength={160} />
            </label>
          )}
          {task === 'enroll' && (
            <>
              <Select label="บัญชีผู้ใช้" name="account" options={data.accounts} showId />
              <Select
                label="บทบาท"
                name="role"
                options={Object.entries(roles).map(([id, name]) => ({ id, name }))}
                value={role}
                onChange={(v) => setRole(v as SchoolRole)}
              />
              {(role === 'teacher' || role === 'student') && (
                <Select label="ห้องเรียน" name="class" options={data.classes} showId />
              )}
              {role === 'guardian' && (
                <Select
                  label="นักเรียนในความดูแล"
                  name="student"
                  options={data.members.filter((m) => m.role === 'student')}
                  showId
                />
              )}
            </>
          )}
          {task === 'invite' && (
            <Select
              label="สมาชิก"
              name="membership"
              options={data.members.map((m) => ({ ...m, name: m.name + ' · ' + roles[m.role] }))}
              showId
            />
          )}
          <Button className="w-fit" type="submit">
            {mutation.isPending ? 'กำลังบันทึก…' : title}
          </Button>
        </fieldset>
        {mutation.isError && (
          <p role="alert" className="text-destructive">
            บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและสิทธิ์ของสมาชิก
          </p>
        )}
        {mutation.isSuccess &&
          ('credential' in mutation.data ? (
            <div role="status" className="grid gap-2 rounded-md border p-4">
              <label>
                รหัสเชิญใช้ครั้งเดียว
                <Input
                  readOnly
                  value={mutation.data.credential}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <p className="text-muted-foreground text-sm">
                หมดอายุ{' '}
                {new Date(mutation.data.expiresAt).toLocaleTimeString('th-TH', {
                  timeZone: 'Asia/Bangkok',
                })}{' '}
                น. เวลาไทย
              </p>
            </div>
          ) : (
            <p role="status">บันทึกข้อมูลแล้ว</p>
          ))}
      </form>
    </Panel>
  );
}
export function AdminPage() {
  const cache = useQueryClient();
  const [selected, setSelected] = useState('');
  const [task, setTask] = useState<Task>('enroll');
  const query = useQuery({
    queryKey: ['admin-directory', selected],
    queryFn: () => directory(selected),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const refresh = async (id?: string) => {
    if (id) setSelected(id);
    await cache.invalidateQueries({ queryKey: ['admin-directory'] });
  };
  const signout = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      setSelected('');
      await cache.resetQueries({ queryKey: ['admin-directory'] });
    },
  });
  const status = query.error instanceof ApiError ? query.error.status : 0;
  return (
    <div className="grid gap-6">
      <PageHeader
        title="จัดการโรงเรียน"
        description="บัญชีผู้ใช้ ห้องเรียน และสิทธิ์การเข้าใช้งาน"
        actions={
          query.isSuccess && (
            <Button variant="outline" disabled={signout.isPending} onClick={() => signout.mutate()}>
              ออกจากระบบ
            </Button>
          )
        }
      />
      {signout.isError && <p role="alert">ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
      {query.isPending ? (
        <p role="status">กำลังโหลดข้อมูล…</p>
      ) : query.isError ? (
        status === 401 || status === 403 ? (
          <AccountAccess
            key={status}
            denied={status === 403}
            onChange={() => cache.resetQueries({ queryKey: ['admin-directory'] })}
          />
        ) : (
          <Button onClick={() => query.refetch()}>ลองโหลดอีกครั้ง</Button>
        )
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[16rem_1fr]">
          <div className="grid gap-5">
            <Select
              label="โรงเรียน"
              name="school"
              options={query.data.schools}
              value={selected}
              onChange={setSelected}
              showId
            />
            <nav className="grid gap-1" aria-label="งานผู้ดูแล">
              {tasks.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  aria-pressed={task === t.id}
                  variant={task === t.id ? 'secondary' : 'ghost'}
                  className="justify-start"
                  onClick={() => setTask(t.id)}
                >
                  <t.icon />
                  {t.label}
                </Button>
              ))}
            </nav>
          </div>
          <SetupForm
            key={task + selected}
            task={task}
            data={query.data}
            schoolId={selected}
            refresh={refresh}
          />
        </div>
      )}
    </div>
  );
}
