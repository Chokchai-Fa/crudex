import { adminDirectorySchema, adminResultSchema, type AdminCommand } from '@repo/shared';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';

export async function directory(schoolId: string) {
  const r = await api.admin.directory.$get({ query: schoolId ? { schoolId } : {} });
  if (!r.ok) throw await toApiError(r, 'โหลดข้อมูลไม่สำเร็จ');
  return adminDirectorySchema.parse(await r.json());
}
export async function save(command: AdminCommand) {
  const r = await api.admin.setup.$post({ json: command });
  if (!r.ok) throw await toApiError(r, 'บันทึกข้อมูลไม่สำเร็จ');
  return adminResultSchema.parse(await r.json());
}
