import { WorkerEntrypoint } from 'cloudflare:workers';
import { dispatchSchema } from '../../../packages/shared/src/school-dispatch.schema';

/** Only the app's named service binding can invoke this entrypoint. */
export class SchoolDispatch extends WorkerEntrypoint<Env> {
  override async fetch(request: Request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/dispatch')
      return new Response(null, { status: 404 });
    const body = dispatchSchema.safeParse(await request.json());
    if (!body.success) return new Response(null, { status: 400 });
    const { scope } = body.data;
    if (
      scope.expiresAt <= Date.now() ||
      scope.expiresAt > Date.now() + 13 * 60_000 ||
      scope.agentId !== body.data.agentId
    )
      return new Response(null, { status: 403 });
    const url = new URL('/school/chat', request.url);
    url.searchParams.set('role', scope.role);
    return this.env.SANDBOX.getByName('main').fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-school-owner': scope.schoolId + '/' + scope.ownerId,
      },
      body: JSON.stringify(body.data),
    });
  }
}
