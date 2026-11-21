import type { AgentDefinition } from './agents/types';
import type { Host } from './harness';

export type RunEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; id: string; status: 'started' | 'success' | 'failed' }
  | { type: 'done'; elapsedMs: number }
  | { type: 'error'; code: string };

interface Turn {
  agent: AgentDefinition;
  directory: string;
  text: string;
  sessionId?: string;
  signal: AbortSignal;
}

async function findSession(host: Host, sessionID: string, signal: AbortSignal) {
  try {
    return await host.session.get({ sessionID }, { signal });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error &&
      '_tag' in error &&
      error._tag === 'SessionNotFoundError'
    ) {
      return undefined;
    }
    throw error;
  }
}

async function belongsToTurn(host: Host, sessionId: string, root: string, signal: AbortSignal) {
  let current: string | undefined = sessionId;
  while (current) {
    if (current === root) return true;
    current = (await findSession(host, current, signal))?.parentID;
  }
  return false;
}

export function createTurnRunner(host: Host) {
  const activeSessions = new Set<string>();

  return async function* runTurn(turn: Turn): AsyncGenerator<RunEvent> {
    const started = performance.now();
    const timeout = AbortSignal.timeout(5 * 60_000);
    const closeEvents = new AbortController();
    const signal = AbortSignal.any([turn.signal, timeout, closeEvents.signal]);
    const opts = { signal };
    let sessionID: string | undefined;
    const delegated = new Set<string>();
    const children = new Map<string, { text: string; formUrl?: string; completed?: boolean }>();
    let promptSent = false;
    let finished = false;

    try {
      const existing = turn.sessionId && (await findSession(host, turn.sessionId, signal));
      const session =
        existing && existing.agent === turn.agent.id && !existing.parentID
          ? existing
          : await host.session.create(
              {
                title: turn.agent.name,
                agent: turn.agent.id,
                model: { providerID: 'openai', id: turn.agent.model },
                location: { directory: turn.directory },
              },
              opts,
            );
      if (activeSessions.has(session.id)) {
        yield { type: 'error', code: 'session_busy' };
        return;
      }
      sessionID = session.id;
      activeSessions.add(sessionID);
      yield { type: 'session', sessionId: sessionID };

      const calls = new Map<string, string>();
      let rootDone = false;
      let rootText = '';
      for await (const event of host.event.subscribe(opts)) {
        if (event.type === 'server.connected') {
          promptSent = true;
          await host.session.prompt({ sessionID, text: turn.text }, opts);
          continue;
        }
        if (event.type === 'permission.asked') {
          if (await belongsToTurn(host, event.data.sessionID, sessionID, signal)) {
            await host.permission.reply(
              {
                sessionID: event.data.sessionID,
                requestID: event.data.id,
                decision: 'reject',
              },
              opts,
            );
          }
          continue;
        }
        if (!('sessionID' in event.data)) continue;
        const source = event.data.sessionID;
        const root = source === sessionID;
        if (!root && !children.has(source)) {
          if (!turn.agent.subagents.length) continue;
          if (
            !delegated.has(source) &&
            (await findSession(host, source, signal))?.parentID !== sessionID
          )
            continue;
          children.set(source, { text: '' });
        }
        const child = children.get(source);

        switch (event.type) {
          case 'session.text.delta':
            if (root) {
              rootText += event.data.delta;
              yield { type: 'delta', text: event.data.delta };
            }
            break;
          case 'session.text.ended':
            if (child) child.text += event.data.text + '\n';
            break;
          case 'session.tool.input.started':
            calls.set(source + '/' + event.data.id, event.data.name);
            yield { type: 'tool', name: event.data.name, id: event.data.id, status: 'started' };
            break;
          case 'session.tool.success':
          case 'session.tool.failed': {
            const name = calls.get(source + '/' + event.data.id);
            if (name) {
              calls.delete(source + '/' + event.data.id);
              if (event.type === 'session.tool.success') {
                const childId = event.data.metadata?.sessionID;
                if (root && name === 'subagent' && typeof childId === 'string')
                  delegated.add(childId);
                if (child && name === 'save_assessment') {
                  for (const part of event.data.content) {
                    if (part.type !== 'text') continue;
                    const result = JSON.parse(part.text);
                    if (result.mode === 'apps-script' && typeof result.formUrl === 'string')
                      child.formUrl = result.formUrl;
                  }
                }
              }
              const status = event.type === 'session.tool.success' ? 'success' : 'failed';
              yield { type: 'tool', name, id: event.data.id, status };
            }
            break;
          }
          case 'session.execution.succeeded':
            if (root) rootDone = true;
            if (child) child.completed = true;
            break;
          case 'session.execution.failed':
          case 'session.execution.interrupted':
            if (child) {
              child.completed = false;
              break;
            }
            finished = true;
            yield {
              type: 'error',
              code:
                event.type === 'session.execution.failed' ? event.data.error.type : 'interrupted',
            };
            return;
        }
        if (!rootDone) continue;
        const results = [...delegated].map((id) => children.get(id));
        if (results.some((result) => result?.completed === undefined)) continue;
        for (const result of results) {
          if (!result?.completed) {
            yield { type: 'error', code: 'delegation_failed' };
            return;
          }
          const reply = result.text.trim();
          if (reply && !rootText.includes(reply)) yield { type: 'delta', text: '\n\n' + reply };
          if (
            result.formUrl &&
            !rootText.includes(result.formUrl) &&
            !reply.includes(result.formUrl)
          ) {
            yield { type: 'delta', text: '\n' + result.formUrl };
          }
        }
        finished = true;
        yield { type: 'done', elapsedMs: Math.round(performance.now() - started) };
        return;
      }
      signal.throwIfAborted();
      yield { type: 'error', code: 'stream_closed' };
    } catch {
      if (!turn.signal.aborted) {
        yield { type: 'error', code: timeout.aborted ? 'timeout' : 'runtime_error' };
      }
    } finally {
      closeEvents.abort();
      if (sessionID) {
        if (promptSent && !finished) {
          await Promise.allSettled(
            [
              sessionID,
              ...[...delegated].filter((id) => children.get(id)?.completed === undefined),
            ].map((id) =>
              host.session.interrupt({ sessionID: id }, { signal: AbortSignal.timeout(2_000) }),
            ),
          );
        }
        activeSessions.delete(sessionID);
      }
    }
  };
}
