import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { LoadError } from '@/components/load-error';
import { NativeSelect } from '@/components/ui/native-select';
import { InvitationForm } from './invitation-form';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api-error';
import { me, login, logout, choose } from './api';
import { roles } from './roles';

export function AccountPage({ returnTo }: { returnTo?: 'admin' }) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['school-access'], queryFn: me, retry: false, gcTime: 0 });
  const refresh = async () => {
    cache.removeQueries({ queryKey: ['admin-directory'] });
    cache.removeQueries({ queryKey: ['school-session'] });
    cache.removeQueries({ queryKey: ['school-data'] });
    await cache.resetQueries({ queryKey: ['school-access'] });
  };
  const auth = useMutation({ mutationFn: login, onSuccess: refresh });
  const exit = useMutation({ mutationFn: logout, onSuccess: refresh });
  const switchRole = useMutation({ mutationFn: choose, onSuccess: refresh });
  const data = query.data;
  if (data && returnTo === 'admin') return <Navigate to="/admin" replace />;
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 wrap-anywhere">
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
              <InvitationForm
                pending={auth.isPending}
                error={auth.error}
                onSubmit={(code) => auth.mutate(code)}
              />
              <Button asChild variant="link" className="mt-3 w-full">
                <Link to="/school">ลองเดโมด้วยข้อมูลตัวอย่าง</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <LoadError
            message="โหลดข้อมูลบัญชีไม่สำเร็จ"
            retry={() => void query.refetch()}
            busy={query.isFetching}
          />
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
                  <NativeSelect
                    disabled={switchRole.isPending}
                    value={data.actor.membershipId}
                    onChange={(e) => switchRole.mutate(e.target.value)}
                  >
                    {data.memberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.schoolName} · {roles[m.role]}
                      </option>
                    ))}
                  </NativeSelect>
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
              {data.actor.role === 'student' && (
                <p className="text-muted-foreground">
                  เปิดลิงก์แบบฝึกที่ครูส่งให้เพื่อทำและส่งคำตอบ
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(data.actor.role === 'teacher' || data.actor.role === 'principal') && (
                  <Button asChild>
                    <Link to="/school">เปิดพื้นที่โรงเรียน</Link>
                  </Button>
                )}
                <Button variant="outline" disabled={exit.isPending} onClick={() => exit.mutate()}>
                  ออกจากระบบ
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
