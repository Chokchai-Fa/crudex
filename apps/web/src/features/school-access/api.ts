import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';
import { meSchema } from '@repo/shared';
export async function me() {
  const r = await api.me.$get();
  if (!r.ok) throw await toApiError(r, 'โหลดบัญชีไม่สำเร็จ');
  return meSchema.parse(await r.json());
}
export async function choose(membershipId: string) {
  const r = await api.auth.membership.$post({ json: { membershipId } });
  if (!r.ok) throw await toApiError(r, 'เปลี่ยนบทบาทไม่สำเร็จ');
  return meSchema.parse(await r.json());
}
export async function login(credential: string) {
  const r = await api.auth.session.$post({ json: { credential } });
  if (!r.ok) throw await toApiError(r, 'รหัสเชิญหมดอายุหรือถูกใช้แล้ว');
}
export async function logout() {
  const r = await api.auth.session.$delete();
  if (!r.ok) throw await toApiError(r, 'ออกจากระบบไม่สำเร็จ');
}
