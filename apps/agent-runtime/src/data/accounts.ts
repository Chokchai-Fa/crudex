import { teacherClasses } from './class-history';
import { sampleOwner } from './sample';

// A teacher account id is derived on the server from the signed login cookie (crudexLoginId),
// never from model input. Every teacher login is a demo teacher with the sample roster (ตัวอย่าง),
// but memories, approvals and other owner-keyed state stay separate per login.
const loginOwnerPattern =
  /^teacher-[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

export function teacherOwnerOf(loginId: string) {
  return 'teacher-' + loginId;
}

export function isTeacherOwner(ownerId: string) {
  return ownerId === sampleOwner || loginOwnerPattern.test(ownerId);
}

/** Rooms this teacher account teaches. Unknown accounts teach nothing. */
export function classesOf(ownerId: string) {
  return isTeacherOwner(ownerId) ? (teacherClasses[sampleOwner] ?? []) : [];
}
