export const kahootMcpPath = '/__kahoot/mcp';
export const kahootTokenHeader = 'x-crudex-kahoot-token';
export const kahootResource = 'https://mcp.kahoot.it/mcp';

const maxBodyBytes = 256 * 1024;
const methods = new Set(['initialize', 'ping', 'tools/list']);
const readTools = new Set(['get_kahoot', 'get_kahoot_editor_url']);
const responseHeaders = ['content-type', 'mcp-session-id', 'mcp-protocol-version'];

export function isKahootMcpRequest(url: URL, method: string) {
  return url.pathname === kahootMcpPath && ['GET', 'POST', 'DELETE'].includes(method);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function allowed(message: unknown) {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string')
    return false;
  if (methods.has(message.method) || message.method.startsWith('notifications/')) return true;
  if (message.method !== 'tools/call' || !isObject(message.params)) return false;

  const { name, arguments: args } = message.params;
  if (typeof name !== 'string') return false;
  if (readTools.has(name)) return true;
  return (
    name === 'create_or_update_kahoot' &&
    (args === undefined || (isObject(args) && !Object.hasOwn(args, 'uuid')))
  );
}

export async function readKahootMcpBody(request: Request) {
  if (!request.body) return request.method === 'POST' ? undefined : null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  let length = 0;
  let body = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBodyBytes) return;
      body += decoder.decode(chunk.value, { stream: true });
    }

    const message: unknown = JSON.parse(body + decoder.decode());
    const messages = Array.isArray(message) ? message : [message];
    if (!messages.length || !messages.every(allowed)) return;
    // Serialize the checked JSON so duplicate keys cannot be interpreted differently upstream.
    return new TextEncoder().encode(JSON.stringify(message));
  } catch {
    return;
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function copyHeaders(source: Headers, names: readonly string[]) {
  const headers = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export async function forwardKahootMcp(request: Request, body: Uint8Array | null, token: string) {
  const headers = copyHeaders(request.headers, [...responseHeaders, 'accept']);
  headers.set('authorization', 'Bearer ' + token);

  const abort = new AbortController();
  const headerTimeout = setTimeout(() => abort.abort(), 60_000);
  try {
    return await fetch(kahootResource, {
      method: request.method,
      body: body ?? undefined,
      headers,
      redirect: 'manual',
      signal: AbortSignal.any([request.signal, abort.signal]),
    });
  } finally {
    clearTimeout(headerTimeout);
  }
}

export function kahootMcpResponse(response: Response) {
  return new Response(response.body, {
    status: response.status,
    headers: copyHeaders(response.headers, responseHeaders),
  });
}
