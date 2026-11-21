import { toast } from 'sonner';
import { roles } from '@/features/school-access/roles';
import { Link } from '@tanstack/react-router';
import { logout } from '@/features/school-access/api';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Building2, Users, BookOpen, UserRoundPlus, Ticket } from 'lucide-react';
import { type AdminCommand, type AdminDirectory, type SchoolRole } from '@repo/shared';
import { PageHeader } from '@/components/page-header';
import { LoadError } from '@/components/load-error';
import { NativeSelect } from '@/components/ui/native-select';
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
      <NativeSelect
        name={name}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        defaultValue={value === undefined ? '' : undefined}
        required
        className="w-full"
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
      </NativeSelect>
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
          <Link to="/account" search={{ returnTo: 'admin' }}>
            เข้าสู่ระบบด้วยรหัสเชิญ
          </Link>
        </Button>
      )}
      {auth.isError && <p role="alert">ออกจากระบบไม่สำเร็จ</p>}
    </Panel>
  );
}
function InvitationResult({
  invitation,
}: {
  invitation: { credential: string; expiresAt: string };
}) {
  const [notice, setNotice] = useState('');
  return (
    <div aria-label="รหัสเชิญที่สร้างแล้ว" className="grid gap-2 rounded-md border p-4">
      <label className="grid gap-2">
        รหัสเชิญใช้ครั้งเดียว
        <Input readOnly value={invitation.credential} onFocus={(e) => e.target.select()} />
      </label>
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(invitation.credential);
            setNotice('คัดลอกรหัสเชิญแล้ว');
          } catch {
            setNotice('แตะช่องรหัสเชิญเพื่อเลือกทั้งหมด แล้วใช้คำสั่งคัดลอก');
          }
        }}
      >
        คัดลอกรหัสเชิญ
      </Button>
      <p role="status" className="text-sm">
        {notice || 'ออกรหัสเชิญแล้ว'}
      </p>
      <p className="text-muted-foreground text-sm">
        หมดอายุ{' '}
        {new Date(invitation.expiresAt).toLocaleString('th-TH', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        })}{' '}
        น. เวลาไทย
      </p>
    </div>
  );
}
function SetupForm({
  task,
  schoolId,
  data,
  refresh,
  onTask,
}: {
  task: Task;
  schoolId: string;
  data: AdminDirectory;
  refresh: (selected?: string) => Promise<void>;
  onTask: (task: Task) => void;
}) {
  const [role, setRole] = useState<SchoolRole>('teacher');
  const [id, setId] = useState(() => crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async (result, c) => {
      if ('id' in result) {
        setId(crypto.randomUUID());
        if (c.action === 'createSchool') toast.success(`สร้างโรงเรียน ${c.name} แล้ว`);
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
        <p>
          {data.schools.length
            ? 'เลือกโรงเรียนที่ต้องการจัดการจากเมนูโรงเรียน'
            : 'สร้างโรงเรียนแรกก่อนเริ่มจัดห้องเรียนและสมาชิก'}
        </p>
        {!data.schools.length && (
          <Button className="mt-3" onClick={() => onTask('createSchool')}>
            สร้างโรงเรียน
          </Button>
        )}
      </Panel>
    );
  if (task === 'enroll' && !data.accounts.length)
    return (
      <Panel title={title}>
        <p>สร้างบัญชีผู้ใช้ก่อนจัดสมาชิกเข้าห้อง</p>
        <Button className="mt-3" onClick={() => onTask('createAccount')}>
          สร้างบัญชี
        </Button>
      </Panel>
    );
  if (task === 'invite' && !data.members.length)
    return (
      <Panel title={title}>
        <p>เพิ่มสมาชิกในโรงเรียนก่อนออกรหัสเชิญ</p>
        <Button className="mt-3" onClick={() => onTask('enroll')}>
          จัดสมาชิกเข้าห้อง
        </Button>
      </Panel>
    );
  const needsClass =
    task === 'enroll' && (role === 'teacher' || role === 'student') && !data.classes.length;
  const needsStudent =
    task === 'enroll' && role === 'guardian' && !data.members.some((m) => m.role === 'student');
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
              <Input name="name" required pattern=".*\S.*" title="กรุณาระบุชื่อ" maxLength={160} />
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
          {needsClass && (
            <div>
              <p>สร้างห้องเรียนก่อนเพิ่มครูหรือนักเรียน</p>
              <Button type="button" variant="link" onClick={() => onTask('createClass')}>
                สร้างห้องเรียน
              </Button>
            </div>
          )}
          {needsStudent && <p>เพิ่มสมาชิกบทบาทนักเรียนก่อนเชื่อมบัญชีผู้ปกครอง</p>}
          <Button className="w-fit" type="submit" disabled={needsClass || needsStudent}>
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
            <InvitationResult key={mutation.data.credential} invitation={mutation.data} />
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
          <LoadError
            message="โหลดข้อมูลโรงเรียนไม่สำเร็จ"
            busy={query.isFetching}
            retry={() => void query.refetch()}
          />
        )
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
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
            onTask={setTask}
          />
        </div>
      )}
    </div>
  );
}
