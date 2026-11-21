import app from './app';
import type { AppBindings } from './env';
import { handleQueue } from './jobs/queue-handler';
import { handleScheduled } from './jobs/scheduled-handler';

export default {
  fetch: app.fetch,
  queue: handleQueue,
  scheduled: handleScheduled,
} satisfies ExportedHandler<AppBindings>;
