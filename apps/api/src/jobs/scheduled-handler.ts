import { enqueueDueReports } from '../services/classroom.service';
import { recoverRuns } from '../services/runs.service';
import { createDeps } from '../middleware/deps';
import { keepCacheAlive } from '../services/keepalive.service';
import type { Deps } from '../types/deps';

/**
 * Workers `scheduled()` handler for the cron triggers in wrangler.toml. Thin like the queue
 * consumer: build deps, call a service. Errors are rethrown so the run shows as failed in the
 * Cloudflare dashboard. `makeDeps` is injectable for tests.
 */
export function createScheduledHandler<Bindings>(makeDeps: (env: Bindings) => Deps) {
  return async function handleScheduled(
    controller: ScheduledController,
    env: Bindings,
    _ctx: ExecutionContext,
  ) {
    try {
      const deps = makeDeps(env);
      if (controller.cron === '*/5 * * * *') {
        await Promise.all([enqueueDueReports(deps), recoverRuns(deps)]);
      } else {
        await keepCacheAlive(deps);
      }
    } catch {
      throw new Error('Scheduled job failed for cron ' + controller.cron);
    }
  };
}

export const handleScheduled = createScheduledHandler(createDeps);
