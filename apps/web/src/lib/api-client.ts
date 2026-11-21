import type { AppType } from 'api/app-type';
import { hc } from 'hono/client';

// Typed client for the same-origin API (`/api/*`). Use it only inside the query/mutation hooks
// in features/<name>/api — components never call it directly.
export const api = hc<AppType>('/').api;
