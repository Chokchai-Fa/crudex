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

function claims(expiresAt: number) {
  return 'crudex-agent.v1.' + expiresAt;
}

export async function sessionCookie(passcode: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1_000) + maxAge;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key(passcode),
    encoder.encode(claims(expiresAt)),
  );
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${cookieName}=${expiresAt}.${hex}; ${cookieAttributes}; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${cookieName}=; ${cookieAttributes}; Max-Age=0`;
}

export async function hasSession(cookies: string | null, passcode: string, now = Date.now()) {
  const cookie = cookies
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(cookieName + '='));
  const [expires, signature] = cookie?.slice(cookieName.length + 1).split('.') ?? [];
  if (
    !cookie ||
    !expires ||
    !signature ||
    cookie !== `${cookieName}=${expires}.${signature}` ||
    !/^\d{1,12}$/.test(expires) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;

  const expiresAt = Number(expires);
  if (expiresAt <= Math.floor(now / 1_000)) return false;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  return crypto.subtle.verify(
    'HMAC',
    await key(passcode),
    bytes,
    encoder.encode(claims(expiresAt)),
  );
}
