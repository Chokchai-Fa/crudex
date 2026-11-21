import { z } from 'zod';
import {
  clearSessionCookie,
  loginIdHeader,
  readSession,
  sessionCookie,
  validPasscode,
} from './gate';
import { isKahootMcpRequest } from './kahoot-mcp';
import { archivePath } from './sandbox';

export { KahootConnection } from './kahoot-connection';
export { MorningBrief } from './morning-brief';
export { SandboxManager } from './sandbox-manager';

const passcodeSchema = z.string().min(1);
const apiRoutes = new Set(['GET /api/status', 'GET /api/agents', 'POST /api/chat']);
const securityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
};

function gatewayPage(lang: 'en' | 'th', title: string, content: string, status: number) {
  return new Response(
    `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { font: 1rem system-ui, sans-serif; background: #f5f7fa; color: #18263a; margin: 0; padding: 24px; }
main { box-sizing: border-box; max-width: 400px; margin: 14vh auto 0; padding: 24px; background: white; border: 1px solid #d9e0ea; border-radius: 14px; }
h1 { margin: 0 0 24px; font-size: 1.5rem; }
label { display: block; margin-bottom: 6px; font-weight: 600; }
input, button { box-sizing: border-box; width: 100%; min-height: 44px; font: inherit; padding: 8px 12px; border-radius: 8px; }
input { border: 1px solid #64748b; }
button { margin-top: 16px; border: 0; background: #254f9a; color: white; cursor: pointer; }
p { color: #a22731; }
</style>
</head>
<body><main>
${content}
</main></body></html>`,
    {
      status,
      headers: {
        ...securityHeaders,
        'content-type': 'text/html; charset=utf-8',
        'referrer-policy': 'no-referrer',
      },
    },
  );
}

function loginPage(status = 200, message = '') {
  return gatewayPage(
    'en',
    'Sign in · Crudex Agent',
    `
<h1>Sign in to Crudex Agent</h1>
${message ? `<p role="alert">${message}</p>` : ''}
<form action="/login" method="post">
<label for="passcode">Passcode</label>
<input id="passcode" name="passcode" type="password" autocomplete="current-password" required maxlength="1024">
<button type="submit">Sign in</button>
</form>`,
    status,
  );
}

function kahootPage(status: 200 | 400 | 502) {
  const heading = status === 200 ? 'เชื่อมบัญชี Kahoot แล้ว' : 'เชื่อมบัญชี Kahoot ไม่สำเร็จ';
  return gatewayPage('th', heading, `<h1>${heading}</h1><a href="/">กลับหน้าหลัก</a>`, status);
}

function redirect(location: string, cookie?: string) {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}

async function readPasscode(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded')
    return;
  const reader = request.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        return;
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    const params = new URLSearchParams(body + decoder.decode());
    const passcodes = params.getAll('passcode');
    if (passcodes.length === 1 && (passcodes[0]?.length ?? 0) <= 1024) return passcodes[0];
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = request.method + ' ' + url.pathname;
    const sandbox = () => env.SANDBOX.getByName('main');
    const kahoot = () => env.KAHOOT.getByName('kahoot');
    if (route === 'GET ' + archivePath || isKahootMcpRequest(url, request.method))
      return sandbox().fetch(request);

    if (route === 'GET /kahoot/callback') {
      const state = url.searchParams.get('state');
      const code = url.searchParams.has('error') ? null : url.searchParams.get('code');
      try {
        return kahootPage(state && (await kahoot().callback(code, state)) ? 200 : 400);
      } catch {
        return kahootPage(502);
      }
    }

    const passcode = passcodeSchema.safeParse(env.PASSCODE);
    if (!passcode.success) {
      return Response.json({ error: 'gateway_unavailable' }, { status: 503 });
    }

    if (route === 'GET /login') return loginPage();

    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
      }
    }
    if (route === 'POST /login') {
      const candidate = await readPasscode(request);
      if (!candidate || !(await validPasscode(candidate, passcode.data))) {
        return loginPage(401, 'Check the passcode and try again.');
      }
      return redirect('/', await sessionCookie(passcode.data));
    }
    if (route === 'POST /logout') return redirect('/login', clearSessionCookie());

    const session = await readSession(request.headers.get('cookie'), passcode.data);
    if (!session) {
      if (route === 'GET /' || route === 'GET /kahoot/connect') return redirect('/login');
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (route === 'GET /kahoot/connect') {
      try {
        return redirect(await kahoot().beginAuthorization(url.origin), session.upgrade);
      } catch {
        return kahootPage(502);
      }
    }
    if (route === 'GET /api/kahoot/status' || route === 'POST /api/kahoot/disconnect') {
      const headers = new Headers({ 'cache-control': 'no-store' });
      if (session.upgrade) headers.set('set-cookie', session.upgrade);
      try {
        if (request.method === 'POST') await kahoot().disconnect();
        return Response.json(await kahoot().status(), { headers });
      } catch {
        return Response.json({ error: 'kahoot_unavailable' }, { status: 502, headers });
      }
    }

    if (route === 'GET /') {
      const asset = await env.ASSETS.fetch(new Request(url.origin + '/'));
      const headers = new Headers(asset.headers);
      for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
      if (session.upgrade) headers.set('set-cookie', session.upgrade);
      return new Response(asset.body, { status: asset.status, headers });
    }
    const brief = route === 'GET /api/brief' || route === 'POST /api/brief/run';
    if (brief || apiRoutes.has(route)) {
      // Rebuild internal headers after authentication; client claims never reach the runtime.
      const internalHeaders = new Headers({ [loginIdHeader]: session.loginId });
      const contentType = request.headers.get('content-type');
      if (contentType) internalHeaders.set('content-type', contentType);
      const target = brief ? env.BRIEFS.getByName('principal') : sandbox();
      const result = await target.fetch(new Request(request, { headers: internalHeaders }));
      const headers = new Headers(result.headers);
      headers.set('cache-control', 'no-store, no-transform');
      if (session.upgrade) headers.set('set-cookie', session.upgrade);
      return new Response(result.body, { status: result.status, headers });
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export { SchoolDispatch } from './school-dispatch';
