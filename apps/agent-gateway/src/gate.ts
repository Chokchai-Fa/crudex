const cookieName = '__Host-crudex-agent';
const maxAge = 86_400;
const cookieAttributes = 'Path=/; HttpOnly; Secure; SameSite=Strict';
const encoder = new TextEncoder();

function key(passcode: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function validPasscode(candidate: string, expected: string) {
  const hmac = await key(expected);
  const digest = await crypto.subtle.sign('HMAC', hmac, encoder.encode(expected));
  return crypto.subtle.verify('HMAC', hmac, digest, encoder.encode(candidate));
}

export const loginIdHeader = 'x-crudex-login-id';
const loginIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validLoginId(value: string | null): value is string {
  return value !== null && loginIdPattern.test(value);
}

async function issueCookie(passcode: string, loginId: string, expiresAt: number, now: number) {
  const value = `${expiresAt}.${loginId}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key(passcode),
    encoder.encode('crudex-agent.v2.' + value),
  );
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${cookieName}=${value}.${hex}; ${cookieAttributes}; Max-Age=${expiresAt - Math.floor(now / 1_000)}`;
}

export function sessionCookie(passcode: string, now = Date.now()) {
  return issueCookie(passcode, crypto.randomUUID(), Math.floor(now / 1_000) + maxAge, now);
}

export function clearSessionCookie() {
  return `${cookieName}=; ${cookieAttributes}; Max-Age=0`;
}

export async function readSession(
  cookies: string | null,
  passcode: string,
  now = Date.now(),
): Promise<{ loginId: string; upgrade?: string } | undefined> {
  const cookie = cookies
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + '='));
  if (!cookie) return;
  const parts = cookie.slice(cookieName.length + 1).split('.');
  if (parts.length !== 2 && parts.length !== 3) return;
  const [expires] = parts;
  const loginId = parts.length === 3 ? parts[1] : undefined;
  const signature = parts.at(-1);
  if (!expires || !/^\d{1,12}$/.test(expires) || !signature || !/^[a-f0-9]{64}$/.test(signature))
    return;
  if (loginId !== undefined && !validLoginId(loginId)) return;
  const expiresAt = Number(expires);
  if (expiresAt <= Math.floor(now / 1_000)) return;

  const claims = loginId ? `crudex-agent.v2.${expires}.${loginId}` : `crudex-agent.v1.${expires}`;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  if (!(await crypto.subtle.verify('HMAC', await key(passcode), bytes, encoder.encode(claims))))
    return;
  if (loginId) return { loginId };

  const newId = crypto.randomUUID();
  return { loginId: newId, upgrade: await issueCookie(passcode, newId, expiresAt, now) };
}
