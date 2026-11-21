import { vi } from 'vitest';
import type { Cache } from '../../src/lib/cache';
import type { Config } from '../../src/env';
import type { Db } from '../../src/db/client';
import type { JobMessage } from '../../src/jobs/messages';
import type { Deps, SchoolGateway } from '../../src/types/deps';

export function makeFakeSchoolGateway(
  fetch: SchoolGateway['fetch'] = async () => new Response(null, { status: 503 }),
): SchoolGateway {
  return {
    fetch,
    kahootConnect: async () => ({ url: 'https://mcp.kahoot.it/authorize' }),
    kahootCallback: async () => ({ ok: false }),
    kahootStatus: async () => ({ connected: false }),
    kahootDisconnect: async () => ({ connected: false }),
  };
}

/**
 * Fake `deps` for services. Repositories are replaced separately with vi.mock, so `db` is never
 * touched. The queue is a plain fake that records what was enqueued.
 */
export function makeFakeDeps(options: { failEnqueue?: boolean } = {}) {
  const enqueued: JobMessage[] = [];
  const enqueue = vi.fn(async (message: JobMessage) => {
    if (options.failEnqueue) throw new Error('queue unavailable');
    enqueued.push(message);
  });

  const deps = {
    config: {} as Config,
    db: {} as Db,
    cache: {} as Cache,
    queue: { enqueue },
  } satisfies Deps;

  return { deps, enqueued, enqueue };
}
