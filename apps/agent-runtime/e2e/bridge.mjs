// Stand-in for the Apps Script bridge: logs each posted quiz and answers with a Google Forms URL.
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    appendFileSync(process.env.BRIDGE_LOG, body + '\n');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        formId: 'form_e2e_1',
        url: 'https://docs.google.com/forms/d/form_e2e_1/viewform',
      }),
    );
  });
}).listen(4793, '127.0.0.1');
