import { draftReports } from '../services/classroom.service';
import { dispatchRun } from '../services/runs.service';
import { createDeps } from '../middleware/deps';
import { handleNoteCreated } from '../services/notes.service';
import type { Deps } from '../types/deps';
import { jobMessageSchema, type JobMessage } from './messages';

/** First try plus the retries in wrangler.toml (`max_retries = 3`). */
export const MAX_ATTEMPTS = 4;
const RETRY_BASE_SECONDS = 10;

export type JobRunner = (deps: Deps, job: JobMessage) => Promise<void>;

/** Dispatches one validated message to its service. Add a case per job type. */
export async function runJob(deps: Deps, job: JobMessage): Promise<void> {
  switch (job.type) {
    case 'dispatch-run':
      return dispatchRun(deps, job.runId);
    case 'draft-reports':
      return draftReports(deps, job.routineId, job.occurrence);
    case 'ping':
      console.log('ping job received', { sentAt: job.sentAt });
      return;
    case 'note-created':
      return handleNoteCreated(deps, job.noteId);
  }
}

/**
 * Workers `queue()` consumer. Validates each message, dispatches by `type` to a service, and
 * acks or retries with backoff. Handlers must be idempotent: Cloudflare redelivers on retry.
 * `makeDeps` and `run` are injectable so the retry rules can be tested with fakes.
 */
export function createQueueHandler<Bindings>(
  makeDeps: (env: Bindings) => Deps,
  run: JobRunner = runJob,
) {
  return async function handleQueue(batch: MessageBatch, env: Bindings, _ctx: ExecutionContext) {
    const deps = makeDeps(env);
    for (const message of batch.messages) {
      const parsed = jobMessageSchema.safeParse(message.body);
      if (!parsed.success) {
        // Poison message: retrying won't fix it. Log the id only and drop it.
        console.error('Invalid queue message dropped', { id: message.id });
        message.ack();
        continue;
      }

      try {
        await run(deps, parsed.data);
        message.ack();
      } catch {
        if (message.attempts >= MAX_ATTEMPTS) {
          console.error('Job gave up', { type: parsed.data.type, id: message.id });
          message.ack();
        } else {
          console.warn('Job will retry', { type: parsed.data.type, id: message.id });
          message.retry({ delaySeconds: RETRY_BASE_SECONDS * 2 ** (message.attempts - 1) });
        }
      }
    }
  };
}

export const handleQueue = createQueueHandler(createDeps);
