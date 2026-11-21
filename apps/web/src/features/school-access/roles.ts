import type { SchoolRole } from '@repo/shared';
export const roles: Record<SchoolRole, string> = {
  teacher: 'ครู',
  student: 'นักเรียน',
  guardian: 'ผู้ปกครอง',
  principal: 'ผู้อำนวยการ',
};
