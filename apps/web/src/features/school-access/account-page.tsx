import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-error';
import { me, login, logout, choose } from './api';
import { roles } from './roles';

export function AccountPage() {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['school-access'], queryFn: me, retry: false, gcTime: 0 });
  const refresh = async () => {
    cache.removeQueries({ queryKey: ['admin-directory'] });
    await cache.resetQueries({ queryKey: ['school-access'] });
  };
  const auth = useMutation({ mutationFn: login, onSuccess: refresh });
  const exit = useMutation({ mutationFn: logout, onSuccess: refresh });
  const switchRole = useMutation({ mutationFn: choose, onSuccess: refresh });
  const data = query.data;
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <PageHeader title="บัญชีโรงเรียน" />
      {query.isPending ? (
        <p role="status">กำลังโหลดบัญชี…</p>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 401 ? (
          <Card>
            <CardHeader>
              <CardTitle>เข้าสู่ระบบด้วยรหัสเชิญ</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  auth.mutate(String(new FormData(e.currentTarget).get('credential')).trim());
                }}
              >
                <label className="grid gap-2">
                  รหัสเชิญจากผู้ดูแล
                  <Input type="password" name="credential" required autoComplete="off" />
                </label>
                <Button disabled={auth.isPending}>เข้าสู่ระบบ</Button>
                {auth.isError && (
                  <p role="alert">เข้าสู่ระบบไม่สำเร็จ ตรวจสอบรหัสเชิญหรือขอรหัสใหม่จากผู้ดูแล</p>
                )}
              </form>
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => query.refetch()}>ลองโหลดอีกครั้ง</Button>
        )
      ) : (
        data && (
          <Card>
            <CardHeader>
              <CardTitle>{data.actor.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p>
                {data.memberships.find((m) => m.id === data.actor.membershipId)?.schoolName} ·{' '}
                {roles[data.actor.role]}
              </p>
              {data.memberships.length > 1 && (
                <label className="grid gap-2">
                  โรงเรียนและบทบาท
                  <select
                    className="bg-background rounded-md border p-2"
                    disabled={switchRole.isPending}
                    value={data.actor.membershipId}
                    onChange={(e) => switchRole.mutate(e.target.value)}
                  >
                    {data.memberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.schoolName} · {roles[m.role]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {data.actor.role === 'guardian' ? (
                <p>
                  นักเรียนในความดูแล:{' '}
                  {data.actor.children.map((c) => c.displayName).join(', ') || 'ยังไม่มี'}
                </p>
              ) : (
                <p>ห้องเรียน: {data.actor.classes.map((c) => c.name).join(', ') || 'ยังไม่มี'}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={exit.isPending} onClick={() => exit.mutate()}>
                  ออกจากระบบ
                </Button>
                <Button asChild variant="outline">
                  <Link to="/school">พื้นที่โรงเรียน</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/admin">สำหรับผู้ดูแลระบบ</Link>
                </Button>
              </div>
              {(exit.isError || switchRole.isError) && (
                <p role="alert">ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง</p>
              )}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
