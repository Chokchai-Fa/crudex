import { afterEach, expect, it, vi } from 'vitest';
import { runEventSchema } from '../../../packages/shared/src/runs.schema';
import { SchoolDispatch } from '../src/school-dispatch';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function turn(agentId = 'jaew') {
  return {
    text: 'สวัสดีค่ะ',
    agentId,
    scope: {
      agentId,
      role: 'teacher',
      schoolId: crypto.randomUUID(),
      ownerId: crypto.randomUUID(),
      classId: null,
      attemptId: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      expiresAt: Date.now() + 600_000,
      credential: crypto.randomUUID() + crypto.randomUUID(),
      freshSession: false,
      callbackOrigin: 'https://school.test',
    },
  };
}

function setup() {
  const sandbox = vi.fn(async () => new Response('sandbox'));
  const env = {
    OPENAI_API_KEY: 'synthetic',
    SANDBOX: { getByName: () => ({ fetch: sandbox }) },
  } as unknown as Env;
  const gateway = new SchoolDispatch({} as ExecutionContext, env);
  const post = (payload: ReturnType<typeof turn>) =>
    gateway.fetch(
      new Request('https://agent.test/dispatch', { method: 'POST', body: JSON.stringify(payload) }),
    );
  return { sandbox, post };
}

const label = (route: string) =>
  Response.json({ choices: [{ message: { content: JSON.stringify({ route }) } }] });

function stream(...deltas: object[]) {
  const body = deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
  return new Response(body.join('') + 'data: [DONE]\n\n');
}

async function events(res: Response) {
  return (await res.text())
    .split('\n\n')
    .filter(Boolean)
    .map((frame) => runEventSchema.parse(JSON.parse(frame.replace(/^data: /, ''))));
}

/** Answers OpenAI calls in order: the router first, then each completion round. */
function openai(...responses: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  const callbacks: { url: string; auth: string | null; body: string }[] = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://school.test/')) {
      callbacks.push({
        url,
        auth: new Headers(init?.headers).get('authorization'),
        body: String(init?.body),
      });
      return Response.json({ ok: true });
    }
    if (url !== 'https://api.openai.com/v1/chat/completions') throw new Error('Unexpected fetch');
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const next = responses.shift();
    if (!next) throw new Error('Unexpected completion');
    return next();
  });
  return { bodies, callbacks };
}

it('answers a greeting from OpenAI without touching the sandbox', async () => {
  const { sandbox, post } = setup();
  const { bodies } = openai(
    () => label('chat'),
    () => stream({ content: 'สวัสดี' }, { content: 'ค่ะ' }),
  );
  const res = await post(turn());
  const out = await events(res);
  expect(out.filter((e) => e.type === 'delta').map((e) => e.text)).toEqual(['สวัสดี', 'ค่ะ']);
  expect(out.at(-1)?.type).toBe('done');
  expect(sandbox).not.toHaveBeenCalled();
  expect(bodies.map((b) => b.model)).toEqual(['gpt-5.4-mini', 'gpt-5.4-mini']);
  expect(bodies[1]).not.toHaveProperty('tools');
});

it('sends task turns, router failures and refused completions to the sandbox', async () => {
  for (const responses of [
    [() => label('task')],
    [() => new Response(null, { status: 500 })],
    [() => Response.json({ choices: [{ message: { content: 'nonsense' } }] })],
    [() => label('chat'), () => new Response(null, { status: 429 })],
  ]) {
    const { sandbox, post } = setup();
    openai(...responses);
    expect(await (await post(turn())).text()).toBe('sandbox');
    expect(sandbox).toHaveBeenCalledOnce();
  }
});

it('never routes agents outside the direct list', async () => {
  const { sandbox, post } = setup();
  openai();
  expect(await (await post(turn('jum'))).text()).toBe('sandbox');
  expect(sandbox).toHaveBeenCalledOnce();
});

it('saves memory through the run callback with the run credential', async () => {
  const { sandbox, post } = setup();
  const payload = turn();
  const args = JSON.stringify({ text: 'ป.5/2 อ่อนเรื่องตัวส่วน', userConfirmed: true });
  const { bodies, callbacks } = openai(
    () => label('memory'),
    () =>
      stream({
        tool_calls: [
          { index: 0, id: 'call-1', function: { name: 'memory_save', arguments: args } },
        ],
      }),
    () => stream({ content: 'กดยืนยันได้เลยค่ะ' }),
  );
  const out = await events(await post(payload));
  expect(callbacks).toEqual([
    {
      url: `https://school.test/api/internal/runs/${payload.scope.runId}/tools/memory_save`,
      auth: 'Bearer ' + payload.scope.credential,
      body: args,
    },
  ]);
  expect(out.filter((e) => e.type === 'tool').map((e) => e.status)).toEqual(['started', 'success']);
  expect(out.at(-1)?.type).toBe('done');
  expect(bodies[1]).toHaveProperty('tools');
  expect(bodies[2]?.messages).toContainEqual(
    expect.objectContaining({ role: 'tool', tool_call_id: 'call-1' }),
  );
  expect(sandbox).not.toHaveBeenCalled();
});

it('reports a tool the route does not allow as failed and ends with an error after a broken round', async () => {
  const { post } = setup();
  const { callbacks } = openai(
    () => label('memory'),
    () =>
      stream({
        tool_calls: [{ index: 0, id: 'call-1', function: { name: 'get_scores', arguments: '{}' } }],
      }),
    () => new Response(null, { status: 500 }),
  );
  const out = await events(await post(turn()));
  expect(callbacks).toEqual([]);
  expect(out.filter((e) => e.type === 'tool').map((e) => e.status)).toEqual(['started', 'failed']);
  expect(out.at(-1)).toEqual({ type: 'error', code: 'runtime_error' });
});
