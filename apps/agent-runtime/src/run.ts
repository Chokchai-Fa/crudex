import type { AgentDefinition } from './agents/types';
import { isOwnedRoot } from './demo-session';
import type { Host } from './harness';

export type RunEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'delta'; messageId: string; text: string }
  | { type: 'progress'; messageId: string }
  | { type: 'principal_brief'; briefId: string; text: string }
  | {
      type: 'tool';
      name: string;
      id: string;
      status: 'started' | 'success' | 'failed';
      agentId?: string;
      bridgeElapsedMs?: number;
    }
  | { type: 'done'; elapsedMs: number }
  | { type: 'error'; code: string };

interface Turn {
  agent: AgentDefinition;
  directory: string;
  loginId: string;
  text: string;
  sessionId?: string;
  signal: AbortSignal;
  school?: boolean;
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
    const children = new Map<
      string,
      { text: string; formUrl?: string; completed?: boolean; agentId?: string; activityId?: string }
    >();
    let delegationCount = 0;
    let promptSent = false;
    let finished = false;

    try {
      const existing = turn.sessionId && (await findSession(host, turn.sessionId, signal));
      if (
        existing &&
        existing.metadata?.crudexLoginId &&
        !isOwnedRoot(existing, turn.agent.id, turn.loginId)
      ) {
        yield { type: 'error', code: 'session_unavailable' };
        return;
      }
      const session =
        existing && isOwnedRoot(existing, turn.agent.id, turn.loginId)
          ? existing
          : await host.session.create(
              {
                title: turn.agent.name,
                metadata: { crudexLoginId: turn.loginId },
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
      const renderedWorksheets = new Set<string>();
      let lessonPrep = false;
      let lessonSkillCall: string | undefined;
      const scoreReports = new Map<string, boolean>();
      const reportInbox = new Map<string, string>();
      let summaryStarted = false;
      let rootDone = false;
      let rootText = '';
      let endedRootMessage: string | undefined;
      let rootMessageWithText: string | undefined;
      let toolContinuationMessage: string | undefined;
      const progressMessages = new Set<string>();
      let toolSteps = 0;
      let outputCharacters = 0;

      function markProgress(messageId: string | undefined): RunEvent | undefined {
        if (!messageId || progressMessages.has(messageId)) return;
        progressMessages.add(messageId);
        return { type: 'progress', messageId };
      }

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
          const childSession = await findSession(host, source, signal);
          if (childSession?.parentID !== sessionID) continue;
          const agentId = childSession.agent;
          children.set(source, {
            text: '',
            agentId: agentId && turn.agent.subagents.includes(agentId) ? agentId : undefined,
          });
        }
        const child = children.get(source);
        if (turn.school) {
          if (event.type === 'session.tool.input.started') toolSteps++;
          if (event.type === 'session.text.delta') outputCharacters += event.data.delta.length;
          if (toolSteps > 32 || outputCharacters > 64_000) {
            yield { type: 'error', code: 'turn_limit' };
            return;
          }
        }

        // Announce a named handoff only once the verified child actually starts work.
        if (
          child?.agentId &&
          !child.activityId &&
          (event.type === 'session.step.started' ||
            event.type === 'session.text.delta' ||
            event.type === 'session.tool.input.started')
        ) {
          child.activityId = 'delegation:' + ++delegationCount;
          child.completed = undefined;
          yield {
            type: 'tool',
            name: 'subagent',
            id: child.activityId,
            agentId: child.agentId,
            status: 'started',
          };
        }
        if (
          child?.activityId &&
          (event.type === 'session.execution.succeeded' ||
            event.type === 'session.execution.failed' ||
            event.type === 'session.execution.interrupted')
        ) {
          yield {
            type: 'tool',
            name: 'subagent',
            id: child.activityId,
            agentId: child.agentId,
            status: event.type === 'session.execution.succeeded' ? 'success' : 'failed',
          };
          child.activityId = undefined;
        }
        switch (event.type) {
          case 'session.tool.called':
            if (root && event.data.executed === false)
              toolContinuationMessage = event.data.assistantMessageID;
            if (
              root &&
              turn.agent.id === 'jaew' &&
              calls.get(source + '/' + event.data.id) === 'skill' &&
              event.data.input.id === 'lesson-prep'
            )
              lessonSkillCall = event.data.id;
            break;
          case 'session.inbox.enqueued': {
            if (!root || !lessonPrep || event.data.item.type !== 'synthetic') break;
            const report = event.data.item.payload.metadata;
            if (
              report?.source === 'subagent' &&
              report.state === 'completed' &&
              typeof report.childID === 'string' &&
              scoreReports.has(report.childID)
            )
              reportInbox.set(event.data.inboxID, report.childID);
            break;
          }
          case 'session.inbox.delivered': {
            const childId = root && reportInbox.get(event.data.inboxID);
            if (childId) {
              scoreReports.set(childId, true);
              reportInbox.delete(event.data.inboxID);
              summaryStarted = false;
              rootDone = false;
            }
            break;
          }
          case 'session.text.delta':
            if (root) {
              if (
                scoreReports.size &&
                [...scoreReports.values()].every(Boolean) &&
                event.data.delta.trim()
              ) {
                summaryStarted = true;
                rootDone = false;
              }
              const { assistantMessageID: messageId, delta } = event.data;
              let text = delta;
              if (text && rootMessageWithText !== messageId) {
                const progress = markProgress(rootMessageWithText);
                if (progress) yield progress;
                rootMessageWithText = messageId;
              }
              if (endedRootMessage && text) {
                const boundary = rootText.slice(-2) + text.slice(0, 2);
                if (!boundary.includes('\n\n')) {
                  text = (rootText.endsWith('\n') || text.startsWith('\n') ? '\n' : '\n\n') + text;
                }
                endedRootMessage = undefined;
              }
              rootText += text;
              yield { type: 'delta', messageId, text };
            }
            break;
          case 'session.text.ended':
            if (root && event.data.text) endedRootMessage = event.data.assistantMessageID;
            if (child) child.text += event.data.text + '\n';
            break;
          case 'session.step.started':
            if (root && rootMessageWithText !== event.data.assistantMessageID) {
              const progress = markProgress(rootMessageWithText);
              if (progress) yield progress;
            }
            break;
          case 'session.step.streamed':
          case 'session.step.ended': {
            if (!root) break;
            const { assistantMessageID: messageId } = event.data;
            if (
              event.type === 'session.step.ended' &&
              event.data.finish === 'length' &&
              endedRootMessage === messageId
            )
              endedRootMessage = undefined;
            // OpenCode publishes step.ended after its tools finish.
            const continues =
              event.type === 'session.step.streamed'
                ? toolContinuationMessage === messageId
                : event.data.finish === 'tool-calls';
            if (continues && rootMessageWithText === messageId) {
              const progress = markProgress(messageId);
              if (progress) yield progress;
            }
            break;
          }
          case 'session.tool.input.started':
            calls.set(source + '/' + event.data.id, event.data.name);
            yield { type: 'tool', name: event.data.name, id: event.data.id, status: 'started' };
            break;
          case 'session.tool.success':
          case 'session.tool.failed': {
            const name = calls.get(source + '/' + event.data.id);
            if (name) {
              calls.delete(source + '/' + event.data.id);
              let bridgeElapsedMs: number | undefined;
              if (event.type === 'session.tool.success') {
                if (root && name === 'skill' && event.data.id === lessonSkillCall)
                  lessonPrep = true;
                const childId = event.data.metadata?.sessionID;
                if (root && name === 'subagent' && typeof childId === 'string') {
                  const childSession = await findSession(host, childId, signal);
                  if (childSession?.parentID === sessionID) {
                    delegated.add(childId);
                    if (lessonPrep && childSession.agent === 'nun') {
                      scoreReports.set(childId, false);
                      summaryStarted = false;
                    }
                  }
                }
                if (root && turn.agent.id === 'rungchao' && name === 'publish_brief') {
                  for (const part of event.data.content) {
                    if (part.type !== 'text') continue;
                    const receipt = JSON.parse(part.text);
                    if (typeof receipt.briefId === 'string' && typeof receipt.text === 'string')
                      yield {
                        type: 'principal_brief',
                        briefId: receipt.briefId,
                        text: receipt.text,
                      };
                  }
                }
                if (name === 'fraction_addition_form') {
                  for (const part of event.data.content) {
                    if (part.type !== 'text') continue;
                    const output = JSON.parse(part.text);
                    if (
                      (output.mode === 'apps-script' || output.mode === 'school') &&
                      typeof output.worksheet === 'string' &&
                      !renderedWorksheets.has(output.formUrl)
                    ) {
                      if (typeof output.bridgeElapsedMs === 'number')
                        bridgeElapsedMs = output.bridgeElapsedMs;
                      const messageId =
                        'worksheet:' +
                        (typeof output.formUrl === 'string' && output.formUrl
                          ? output.formUrl
                          : renderedWorksheets.size);
                      renderedWorksheets.add(output.formUrl);
                      endedRootMessage = undefined;
                      yield { type: 'delta', messageId, text: '\n\n' + output.worksheet + '\n\n' };
                    }
                  }
                }
                if (child && name === 'save_assessment') {
                  for (const part of event.data.content) {
                    if (part.type !== 'text') continue;
                    const result = JSON.parse(part.text);
                    if (
                      (result.mode === 'apps-script' || result.mode === 'school') &&
                      typeof result.formUrl === 'string'
                    )
                      child.formUrl = result.formUrl;
                  }
                }
              }
              const status = event.type === 'session.tool.success' ? 'success' : 'failed';
              yield { type: 'tool', name, id: event.data.id, status, bridgeElapsedMs };
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
        if (
          results.some((result) => result?.completed === undefined) ||
          (results.every((result) => result?.completed) && scoreReports.size && !summaryStarted)
        ) {
          const progress = markProgress(rootMessageWithText);
          if (progress) yield progress;
          continue;
        }
        for (const id of delegated) {
          const result = children.get(id);
          if (!result?.completed) {
            yield { type: 'error', code: 'delegation_failed' };
            return;
          }
          if (scoreReports.has(id)) continue;
          const reply = result.text.trim();
          const messageId = 'reply:' + id;
          if (reply && !rootText.includes(reply))
            yield { type: 'delta', messageId, text: '\n\n' + reply };
          if (
            result.formUrl &&
            !rootText.includes(result.formUrl) &&
            !reply.includes(result.formUrl)
          ) {
            yield { type: 'delta', messageId, text: '\n' + result.formUrl };
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
