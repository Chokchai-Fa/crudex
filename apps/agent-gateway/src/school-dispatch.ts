import { WorkerEntrypoint } from 'cloudflare:workers';
import { z } from 'zod';
import {
  dispatchSchema,
  schoolKahootAccountSchema,
  schoolKahootCallbackPath,
  type SchoolKahootAccount,
  type SchoolKahootRpc,
} from '../../../packages/shared/src/school-dispatch.schema';
import { directReply } from './direct-reply';
import { kahootInstanceName, parseKahootState } from './kahoot-state';
import { openaiReply, usesOpenAI } from './openai-backend';
import { sandboxInstanceName } from './sandbox';

// Only the gateway can attach the teacher's connection state to a signed turn.
const incomingDispatchSchema = dispatchSchema.extend({
  scope: dispatchSchema.shape.scope.omit({ kahootConnected: true }),
});

const schoolRedirectUri = z.url().refine((value) => {
  const url = new URL(value);
  return (
    value === url.origin + schoolKahootCallbackPath &&
    (url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  );
});

function schoolOwner({ schoolId, ownerId }: Pick<SchoolKahootAccount, 'schoolId' | 'ownerId'>) {
  return schoolId + '/' + ownerId;
}

export class SchoolDispatch extends WorkerEntrypoint<Env> implements SchoolKahootRpc {
  #kahoot(account: SchoolKahootAccount) {
    const teacher = schoolKahootAccountSchema.parse(account);
    if (teacher.role !== 'teacher') throw new Error('Forbidden');
    return this.env.KAHOOT.getByName(kahootInstanceName(schoolOwner(teacher)));
  }

  async kahootConnect(account: SchoolKahootAccount, redirectUri: string) {
    const connection = this.#kahoot(account);
    return { url: await connection.beginAuthorization(schoolRedirectUri.parse(redirectUri)) };
  }

  async kahootCallback(state: string, code: string | null) {
    const parsed = parseKahootState(state);
    if (parsed?.kind !== 'school') return { ok: false };
    return { ok: await this.env.KAHOOT.getByName(parsed.name).callback(code, state) };
  }

  async kahootStatus(account: SchoolKahootAccount) {
    return await this.#kahoot(account).status();
  }

  async kahootDisconnect(account: SchoolKahootAccount) {
    const connection = this.#kahoot(account);
    await connection.disconnect();
    return await connection.status();
  }

  override async fetch(request: Request) {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/dispatch')
      return new Response(null, { status: 404 });
    const body = incomingDispatchSchema.safeParse(await request.json());
    if (!body.success) return new Response(null, { status: 400 });
    const { scope } = body.data;
    if (
      scope.expiresAt <= Date.now() ||
      scope.expiresAt > Date.now() + 13 * 60_000 ||
      scope.agentId !== body.data.agentId
    )
      return new Response(null, { status: 403 });
    // With AGENT_BACKEND = "openai", chat and memory turns and ported agents skip the sandbox.
    if (usesOpenAI(this.env)) {
      const key = this.env.OPENAI_API_KEY;
      const reply =
        (await directReply(key, body.data)) ?? (await openaiReply(key, this.env, body.data));
      if (reply) return reply;
    }
    const kahootConnected =
      scope.role === 'teacher' && (scope.agentId === 'jaew' || scope.agentId === 'jeng')
        ? await this.kahootStatus({
            schoolId: scope.schoolId,
            ownerId: scope.ownerId,
            role: scope.role,
          })
            .then((status) => status.connected)
            .catch(() => undefined)
        : undefined;
    const url = new URL('/school/chat', request.url);
    url.searchParams.set('role', scope.role);
    if (!(await this.env.SANDBOX.getByName('main').admitRun()))
      return Response.json({ error: 'daily_limit' }, { status: 429 });
    // Each teacher has their own sandbox, so one teacher's turn never reboots another's.
    return this.env.SANDBOX.getByName(sandboxInstanceName(schoolOwner(scope))).fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-school-owner': schoolOwner(scope),
      },
      body: JSON.stringify({ ...body.data, scope: { ...scope, kahootConnected } }),
    });
  }
}
