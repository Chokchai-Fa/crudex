// Scripted OpenAI-compatible model: "CALL <tool> <json>" in the last user message makes it call that tool
// (only if opencode offered it); "FORCE <tool> <json>" calls it even when it was not offered.
// After a tool result it echoes the result so the test can read what the agent received.
import http from 'node:http';

const port = Number(process.env.MOCK_PORT ?? 4777);
export const seen = [];

const chunk = (delta, finish = null) =>
  'data: ' +
  JSON.stringify({
    id: 'mock',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'm1',
    choices: [{ index: 0, delta, finish_reason: finish }],
  }) +
  '\n\n';

function textOf(content) {
  return typeof content === 'string' ? content : (content ?? []).map((p) => p.text ?? '').join('');
}

http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      if (req.method === 'GET') {
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ data: [{ id: 'm1', object: 'model' }] }));
        return;
      }
      const reqJson = JSON.parse(body || '{}');
      const tools = (reqJson.tools ?? []).map((t) => t.function?.name);
      const last = reqJson.messages?.at(-1);
      seen.push({ tools });
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const say = (text) => {
        res.write(chunk({ role: 'assistant', content: text }));
        res.write(chunk({}, 'stop'));
        res.write('data: [DONE]\n\n');
        res.end();
      };
      if (last?.role === 'tool') return say('TOOL_RESULT ' + textOf(last.content));
      const userText = textOf(reqJson.messages?.filter((m) => m.role === 'user').at(-1)?.content);
      const m = /(?:CALL|FORCE) (\w+)(?: (\{.*\}))?/s.exec(userText);
      const force = /FORCE /.test(userText);
      if (!m) return say('TOOLS ' + tools.join(','));
      if (!force && !tools.includes(m[1]))
        return say('NOT_OFFERED ' + m[1] + ' TOOLS ' + tools.join(','));
      res.write(
        chunk({
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: m[1], arguments: m[2] ?? '{}' },
            },
          ],
        }),
      );
      res.write(chunk({}, 'tool_calls'));
      res.write('data: [DONE]\n\n');
      res.end();
    });
  })
  .listen(port, '127.0.0.1', () => console.log('mock model on', port));
