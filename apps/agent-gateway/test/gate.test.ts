import { expect, it } from 'vitest';
import { clearSessionCookie, hasSession, sessionCookie, validPasscode } from '../src/gate';

const sample = 'sample passcode only';
const now = 1_800_000_000_000;

it('compares passcodes including Unicode and unequal lengths', async () => {
  expect(await validPasscode(sample, sample)).toBe(true);
  expect(await validPasscode('wrong', sample)).toBe(false);
  expect(await validPasscode('คีย์ตัวอย่าง', 'คีย์ตัวอย่าง')).toBe(true);
});

it('issues a Secure HttpOnly cookie that expires and is rejected after passcode rotation', async () => {
  const cookie = await sessionCookie(sample, now);
  expect(cookie).toContain('HttpOnly; Secure; SameSite=Strict');
  const token = cookie.split(';')[0] ?? '';
  expect(await hasSession('other=1; ' + token, sample, now)).toBe(true);
  expect(await hasSession(token, 'different sample', now)).toBe(false);
  expect(await hasSession(token, sample, now + 86_400_000)).toBe(false);
  expect(await hasSession(token + '0', sample, now)).toBe(false);
  expect(await hasSession(null, sample, now)).toBe(false);
  expect(clearSessionCookie()).toContain('Max-Age=0');
});
