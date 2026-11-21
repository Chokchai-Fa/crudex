import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { agents, teacherAgents } from './agents';
import { createHarness } from './harness';
import { createTurnRunner } from './run';
import { tools } from './tools';

const config = z
  .object({
    OPENAI_API_KEY: z.string().min(1),
    UPSTREAM_TOKEN: z.string().min(1),
    DATA_DIR: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8790),
    HOST: z.string().min(1).default('0.0.0.0'),
  })
  .safeParse(process.env);

if (!config.success) {
  throw new Error(
    'Invalid runtime environment: ' +
      config.error.issues.map(({ path }) => path.join('.')).join(', '),
  );
}

const { UPSTREAM_TOKEN, DATA_DIR, PORT, HOST } = config.data;
const expectedToken = Buffer.from(UPSTREAM_TOKEN);
const { host, directory, toolCalls } = await createHarness(resolve(DATA_DIR));
const runTurn = createTurnRunner(host);
const chatBody = z.object({
  agentId: z.string().min(1).max(100),
  text: z.string().max(4_000).trim().min(1),
  sessionId: z.string().min(1).max(256).optional(),
});

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readChat(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  // Leave the socket open long enough to return a validation response on oversized bodies.
  const iterator = request.iterator({ destroyOnReturn: false });
  for await (const chunk of iterator) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > 32_768) {
      request.resume();
      return;
    }
    chunks.push(bytes);
  }
  try {
    return chatBody.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return;
  }
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const header = request.headers['x-crudex-upstream-token'];
  const sent = Buffer.from(typeof header === 'string' ? header : '');
  if (sent.length !== expectedToken.length || !timingSafeEqual(sent, expectedToken)) {
    return json(response, 401, { error: 'unauthorized' });
  }

  const { pathname: path, searchParams } = new URL(request.url ?? '/', 'http://localhost');
  const role = searchParams.get('role') ?? 'teacher';
  if (role !== 'teacher' && role !== 'principal')
    return json(response, 400, { error: 'invalid_role' });
  const visibleAgents =
    role === 'principal'
      ? agents.filter(({ id }) => id === 'rungchao' || id === 'lekha_por')
      : teacherAgents;
  if (request.method === 'GET' && path === '/__health') {
    return json(response, 200, {
      ok: true,
      agents: agents.map(({ id }) => id),
      tools: tools.map(({ name }) => name),
    });
  }
  if (request.method === 'GET' && path === '/__stats') {
    return json(response, 200, { toolCalls: Object.fromEntries(toolCalls) });
  }
  if (request.method === 'GET' && path === '/agents') {
    return json(
      response,
      200,
      visibleAgents.map(({ id, name, description }) => ({ id, name, description })),
    );
  }
  if (request.method !== 'POST' || path !== '/chat') {
    return json(response, 404, { error: 'not_found' });
  }

  const body = await readChat(request);
  if (!body?.success) return json(response, 400, { error: 'invalid_chat' });
  const { agentId, text, sessionId } = body.data;
  const agent = visibleAgents.find(({ id }) => id === agentId);
  if (!agent) return json(response, 400, { error: 'unknown_agent' });

  const abort = new AbortController();
  response.once('close', () => {
    if (!response.writableFinished) abort.abort();
  });
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    'x-accel-buffering': 'no',
  });
  response.flushHeaders();
  const events = runTurn({ agent, directory, text, sessionId, signal: abort.signal });
  async function* encode() {
    for await (const event of events) yield `data: ${JSON.stringify(event)}\n\n`;
  }
  await pipeline(encode(), response, { signal: abort.signal });
}

const server = createServer((request, response) => {
  void handle(request, response).catch(() => {
    if (!response.headersSent) json(response, 500, { error: 'runtime_error' });
    else response.destroy();
  });
});
server.listen(PORT, HOST);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    void host.close();
  });
}
