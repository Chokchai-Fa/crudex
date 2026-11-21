import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { schoolKahootCallbackPath, type ErrorResponse } from '@repo/shared';
import { AppError } from './lib/errors';
import { depsMiddleware } from './middleware/deps';
import { memoryRoutes } from './routes/memory.routes';
import { meRoutes } from './routes/me.routes';
import { runRoutes } from './routes/runs.routes';
import { agentDirectoryRoutes } from './routes/agents.routes';
import { approvalRoutes } from './routes/approvals.routes';
import { classroomRoutes } from './routes/classroom.routes';
import { healthRoutes } from './routes/health.routes';
import { kahootRoutes } from './routes/kahoot.routes';
import { notesRoutes } from './routes/notes.routes';
import type { AppEnv } from './types/app';

/** The only place AppError codes become HTTP statuses. */
const errorStatus: Record<string, ContentfulStatusCode> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

/** Maps errors to HTTP responses. The only place AppError codes become statuses. */
export function handleError(err: Error, c: Context<AppEnv>) {
  if (err instanceof AppError) {
    const status = errorStatus[err.code] ?? 400;
    return c.json<ErrorResponse>({ error: { code: err.code, message: err.message } }, status);
  }
  if (err instanceof HTTPException && err.status === 400) {
    return c.json<ErrorResponse>(
      { error: { code: 'validation_error', message: 'Invalid request body' } },
      400,
    );
  }
  console.error('Unhandled error', { requestId: c.get('requestId') });
  return c.json<ErrorResponse>(
    { error: { code: 'internal_error', message: 'Something went wrong' } },
    500,
  );
}

const logRequest = logger();

// One chain, so `AppType` carries the full route schema for the RPC client. Add routers with
// `.route()` before `.notFound()`.
const app = new Hono<AppEnv>()
  .basePath('/api')
  .use(requestId())
  .use((c, next) => (c.req.path === schoolKahootCallbackPath ? next() : logRequest(c, next)))
  .use(depsMiddleware)
  .route('/', memoryRoutes)
  .route('/', meRoutes)
  .route('/', runRoutes)
  .route('/', classroomRoutes)
  .route('/', approvalRoutes)
  .route('/', agentDirectoryRoutes)
  .route('/health', healthRoutes)
  .route('/integrations/kahoot', kahootRoutes)
  .route('/notes', notesRoutes)
  .notFound((c) =>
    c.json<ErrorResponse>({ error: { code: 'not_found', message: 'Route not found' } }, 404),
  )
  .onError(handleError);

export type AppType = typeof app;
export default app;
