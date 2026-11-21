import { meSchema } from '@repo/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

export type DemoRole = 'teacher' | 'principal';
const roleKey = 'crudex.session.role';
const localSchool =
  import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export async function sessionRole() {
  if (localSchool) {
    const response = await api.me.$get();
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('ตรวจสอบบัญชีโรงเรียนไม่สำเร็จ กรุณาลองอีกครั้ง');
    return meSchema.parse(await response.json()).actor.role;
  }
  return sessionStorage.getItem(roleKey);
}

export async function signInDemo(role: DemoRole) {
  if (localSchool) {
    const response = await api.auth.local.$post({ json: { school: 'lotus', account: 1, role } });
    if (!response.ok || meSchema.parse(await response.json()).actor.role !== role)
      throw new Error('เข้าใช้บัญชีตัวอย่างไม่สำเร็จ');
  } else {
    sessionStorage.setItem(roleKey, role);
  }
  queryClient.clear();
}

export async function signOutDemo() {
  if (localSchool) {
    try {
      const response = await api.auth.session.$delete();
      if (!response.ok) throw new Error();
    } catch {
      toast.error('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
      return;
    }
  }
  queryClient.clear();
  sessionStorage.removeItem(roleKey);
  window.location.replace('/');
}
