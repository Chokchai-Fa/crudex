import type { SchoolKahootRpc } from '@repo/shared';
import type { Db } from '../db/client';
import type { Config } from '../env';
import type { Cache } from '../lib/cache';
import type { JobQueue } from '../lib/queue';

export type SchoolGateway = Pick<Fetcher, 'fetch'> & SchoolKahootRpc;

/** Everything services need, passed explicitly as their first argument. */
export interface Deps {
  config: Config;
  agentGateway?: SchoolGateway;
  db: Db;
  cache: Cache;
  queue: JobQueue;
}
