import { z } from 'zod';
import type { RunEvent } from '../../../packages/shared/src/runs.schema';
import type { dispatchSchema } from '../../../packages/shared/src/school-dispatch.schema';

export type Turn = z.infer<typeof dispatchSchema>;

/** A function tool the model may call. `run` returns the text the model reads back; a throw marks the call failed. */
export interface AgentTool {
  name: string;
  description: string;
  parameters: object;
  run(args: string, signal: AbortSignal): Promise<string>;
}

export interface AgentSpec {
  model: string;
  instructions: string;
  tools: AgentTool[];
}

const completionsUrl = 'https://api.openai.com/v1/chat/completions';
const replyTimeout = 120_000;
const maxRounds = 6;

const chunkSchema = z.object({
  choices: z.array(
    z.object({
      delta: z.object({
        content: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              index: z.number().int().min(0).max(7),
              id: z.string().optional(),
              function: z
                .object({ name: z.string().optional(), arguments: z.string().optional() })
                .optional(),
            }),
          )
          .optional(),
      }),
    }),
  ),
});

export function complete(key: string, body: object, signal: AbortSignal) {
  return fetch(completionsUrl, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

async function* chunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        const parsed = chunkSchema.safeParse(JSON.parse(line.slice(6)));
        if (parsed.success) yield parsed.data;
      }
      if (buffer.length > 64_000) throw new Error('Invalid stream');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Calls a school API tool with the run credential, the same contract the sandbox runtime uses. */
export function callbackTool(
  turn: Turn,
  name: string,
  description: string,
  parameters: object,
): AgentTool {
  return {
    name,
    description,
    parameters,
    async run(args, signal) {
      const { scope } = turn;
      const url = new URL(`/api/internal/runs/${scope.runId}/tools/${name}`, scope.callbackOrigin);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + scope.credential,
          'content-type': 'application/json',
        },
        body: args || '{}',
        signal,
        redirect: 'error',
      });
      const result = await res.text();
      if (!res.ok) throw new Error('tool_failed');
      return result;
    },
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Streams an agent turn from OpenAI as run events, running tool calls in the Worker between
 * rounds. Returns undefined when OpenAI refuses the first request, so the caller can fall back.
 */
export async function streamAgent(
  key: string,
  turn: Turn,
  spec: AgentSpec,
  started = Date.now(),
): Promise<Response | undefined> {
  const signal = AbortSignal.timeout(Math.min(turn.scope.expiresAt - Date.now(), replyTimeout));
  const tools = new Map(spec.tools.map((tool) => [tool.name, tool]));
  const messages: object[] = [
    { role: 'system', content: spec.instructions },
    { role: 'user', content: turn.text },
  ];
  const request = (round: number) =>
    complete(
      key,
      {
        model: spec.model,
        reasoning_effort: 'low',
        stream: true,
        messages,
        // The last round must answer, so it gets no tools.
        ...(tools.size &&
          round < maxRounds - 1 && {
            tools: spec.tools.map(({ name, description, parameters }) => ({
              type: 'function',
              function: { name, description, parameters },
            })),
          }),
      },
      signal,
    );

  const first = await request(0).catch(() => undefined);
  if (!first?.ok || !first.body) {
    await first?.body?.cancel();
    return;
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event: RunEvent) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  void (async () => {
    try {
      let res: Response = first;
      for (let round = 0; ; round++) {
        if (!res.ok || !res.body) throw new Error('completion_failed');
        const messageId = crypto.randomUUID();
        let text = '';
        const calls: ToolCall[] = [];
        for await (const chunk of chunks(res.body)) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            text += delta.content;
            await send({ type: 'delta', messageId, text: delta.content });
          }
          for (const part of delta.tool_calls ?? []) {
            const call = (calls[part.index] ??= { id: '', name: '', arguments: '' });
            if (part.id) call.id = part.id;
            call.name += part.function?.name ?? '';
            call.arguments += part.function?.arguments ?? '';
          }
        }
        const pending = calls.filter(Boolean);
        if (!pending.length || round >= maxRounds - 1) break;

        messages.push({
          role: 'assistant',
          content: text || null,
          tool_calls: pending.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.arguments },
          })),
        });
        for (const call of pending) {
          await send({ type: 'tool', name: call.name, id: call.id, status: 'started' });
          let content: string;
          try {
            const tool = tools.get(call.name);
            if (!tool) throw new Error('unknown_tool');
            content = await tool.run(call.arguments, signal);
            await send({ type: 'tool', name: call.name, id: call.id, status: 'success' });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'tool_failed';
            content = JSON.stringify({ error: message });
            await send({ type: 'tool', name: call.name, id: call.id, status: 'failed' });
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content });
        }
        res = await request(round + 1);
      }
      await send({ type: 'done', elapsedMs: Date.now() - started });
    } catch {
      await send({ type: 'error', code: signal.aborted ? 'timeout' : 'runtime_error' }).catch(
        () => undefined,
      );
    } finally {
      await writer.close().catch(() => undefined);
    }
  })();

  return new Response(readable, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' },
  });
}
