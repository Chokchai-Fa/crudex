import { vi } from 'vitest';
import type { Cache } from '../../src/lib/cache';
import type { Config } from '../../src/env';
import type { Db } from '../../src/db/client';
import type { JobMessage } from '../../src/jobs/messages';
import type { Deps } from '../../src/types/deps';

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
