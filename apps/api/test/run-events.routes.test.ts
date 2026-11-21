import { exports } from 'cloudflare:workers';
import { runEventBatchMediaType, runEventBatchSchema, type SchoolActor } from '@repo/shared';
import { beforeEach, expect, it, vi } from 'vitest';
import { replay } from '../src/services/runs.service';
import { authenticate } from '../src/services/identity.service';
import { NotFoundError } from '../src/lib/errors';

vi.mock('../src/services/runs.service');
vi.mock('../src/services/identity.service');
const id = crypto.randomUUID();
function read(accept: string, cursor = '0') {
  return exports.default.fetch('https://example.com/api/runs/' + id + '/events', {
    headers: { Accept: accept, 'Last-Event-ID': cursor },
  });
}
const actor: SchoolActor = {
  ownerId: crypto.randomUUID(),
  schoolId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
  role: 'teacher',
  displayName: 'Teacher',
  classes: [],
  children: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authenticate).mockResolvedValue(actor);
});
it('returns committed events as a JSON batch with stable IDs and source', async () => {
  vi.mocked(replay).mockResolvedValue({
    terminal: false,
    events: [
      { id: 10, body: { type: 'status', status: 'running' } },
      { id: 13, body: { type: 'tool', name: 'save_assessment', id: 'call', status: 'started' } },
    ],
  });
  const res = await read(runEventBatchMediaType, '8');
  expect(res.headers.get('Content-Type')).toContain(runEventBatchMediaType);
  expect(res.headers.get('Vary')).toContain('Accept');
  expect(runEventBatchSchema.parse(await res.json())).toEqual([
    {
      specversion: '1.0',
      source: '/api/runs/' + id,
      id: '10',
      type: 'work.crudex.run.status',
      data: { type: 'status', status: 'running' },
    },
    {
      specversion: '1.0',
      source: '/api/runs/' + id,
      id: '13',
      type: 'work.crudex.run.tool',
      data: { type: 'tool', name: 'save_assessment', id: 'call', status: 'started' },
    },
  ]);
  expect(authenticate).toHaveBeenCalled();
  expect(replay).toHaveBeenCalledWith(expect.anything(), actor, id, 8);
});
it('distinguishes waiting, final data and an exhausted terminal cursor', async () => {
  vi.mocked(replay)
    .mockResolvedValueOnce({ terminal: false, events: [] })
    .mockResolvedValueOnce({
      terminal: true,
      events: [{ id: 7, body: { type: 'error', code: 'cancelled' } }],
    })
    .mockResolvedValueOnce({ terminal: true, events: [] });
  expect(await (await read(runEventBatchMediaType)).json()).toEqual([]);
  expect(await (await read(runEventBatchMediaType)).json()).toMatchObject([
    { id: '7', data: { code: 'cancelled' } },
  ]);
  expect((await read(runEventBatchMediaType, '7')).status).toBe(204);
});
it.each(['*/*', 'text/event-stream'])('preserves SSE for %s', async (accept) => {
  vi.mocked(replay).mockResolvedValue({
    terminal: false,
    events: [{ id: 7, body: { type: 'delta', text: 'hello' } }],
  });
  const res = await read(accept);
  expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  expect(await res.text()).toContain('id: 7\ndata: {"type":"delta","text":"hello"}\n\n');
});
it('rejects invalid cursors and preserves run ownership errors', async () => {
  expect((await read(runEventBatchMediaType, '-1')).status).toBe(400);
  expect(replay).not.toHaveBeenCalled();
  vi.mocked(replay).mockRejectedValue(new NotFoundError());
  expect((await read(runEventBatchMediaType)).status).toBe(404);
});
