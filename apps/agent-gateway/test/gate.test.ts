import { expect, it, vi } from 'vitest';
import { clearSessionCookie, readSession, sessionCookie, validPasscode } from '../src/gate';

vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }));

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
  expect(await readSession('other=1; ' + token, sample, now)).toMatchObject({
    loginId: expect.any(String),
  });
  expect(await readSession(token, 'different sample', now)).toBeUndefined();
  expect(await readSession(token, sample, now + 86_400_000)).toBeUndefined();
  expect(await readSession(token + '0', sample, now)).toBeUndefined();
  expect(await readSession(null, sample, now)).toBeUndefined();
  expect(clearSessionCookie()).toContain('Max-Age=0');
});

it('assigns distinct signed chat identities to simultaneous logins', async () => {
  const first = (await sessionCookie(sample, now)).split(';')[0]!;
  const second = (await sessionCookie(sample, now)).split(';')[0]!;
  const a = await readSession(first, sample, now);
  const b = await readSession(second, sample, now);
  expect(a?.loginId).toBeTruthy();
  expect(a?.loginId).not.toBe(b?.loginId);
  expect(await readSession(first.replace(a!.loginId, b!.loginId), sample, now)).toBeUndefined();
});

it('upgrades a signed legacy cookie without extending its expiration', async () => {
  const expires = Math.floor(now / 1_000) + 60;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sample),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode('crudex-agent.v1.' + expires),
  );
  const hex = [...new Uint8Array(signed)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const old = '__Host-crudex-agent=' + expires + '.' + hex;
  const upgraded = await readSession(old, sample, now);
  expect(upgraded?.upgrade).toContain('Max-Age=60');
  expect(await readSession(upgraded!.upgrade!.split(';')[0]!, sample, now)).toEqual({
    loginId: upgraded?.loginId,
  });
  expect(await readSession(old, sample, now + 60_000)).toBeUndefined();
});

it('forwards only the gate-issued login identity to the private chat service', async () => {
  const gateway = (await import('../src/index')).default;
  const cookie = (await sessionCookie(sample)).split(';')[0]!;
  const session = await readSession(cookie, sample);
  let upstreamHeaders: Headers | undefined;
  const env = {
    PASSCODE: sample,
    SANDBOX: {
      getByName: () => ({
        fetch: async (request: Request) => {
          upstreamHeaders = request.headers;
          expect(await request.json()).toEqual({ agentId: 'jaew', text: 'demo' });
          return Response.json({ ok: true });
        },
      }),
    },
  };
  const response = await gateway.fetch(
    new Request('https://crudex.example/api/chat', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        'x-crudex-login-id': 'ignored',
        'x-owner-id': 'ignored',
      },
      body: JSON.stringify({ agentId: 'jaew', text: 'demo' }),
    }),
    env as unknown as Env,
  );
  expect(response.ok).toBe(true);
  expect(upstreamHeaders?.get('x-crudex-login-id')).toBe(session?.loginId);
  expect(upstreamHeaders?.has('cookie')).toBe(false);
  expect(upstreamHeaders?.has('x-owner-id')).toBe(false);
});
