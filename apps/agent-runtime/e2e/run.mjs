// Real-opencode e2e for the five teacher agents with a scripted model (no key, no network).
// Usage: node e2e/run.mjs   (OPENCODE_BIN=... to choose the binary; E2E_DEBUG=1 for raw output)
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const OC =
  process.env.OPENCODE_BIN ??
  '/Users/mac/Documents/agent-school-bot/app/node_modules/.bin/opencode';
const base = 20000 + Math.floor(Math.random() * 20000);
const root = `/tmp/crudex-agents-e2e-${process.pid}`;
const PORT = { mock: base, serve: base + 1, bridge: base + 2 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const auth = { authorization: 'Basic ' + Buffer.from('opencode:e2e-pass').toString('base64') };
const debug = process.env.E2E_DEBUG;

rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, '.opencode/plugins'), { recursive: true });
execFileSync(join(pkg, 'node_modules/.bin/esbuild'), [
  join(here, 'entry.ts'),
  '--bundle',
  '--format=esm',
  '--platform=node',
  '--target=node22',
  '--log-level=error',
  `--outfile=${join(root, '.opencode/plugins/crudex.js')}`,
]);
// The agents pin openai/gpt-6.2-sol (test-agent keeps gpt-5.4-mini); route that provider to the scripted model.
writeFileSync(
  join(root, 'opencode.jsonc'),
  JSON.stringify({
    providers: {
      openai: {
        name: 'OpenAI (scripted)',
        env: ['MOCK_KEY'],
        package: '@opencode/ai/providers/openai-compatible',
        settings: { baseURL: `http://127.0.0.1:${PORT.mock}/v1` },
        models: {
          ...JSON.parse(readFileSync(join(pkg, 'openai-models.json'), 'utf8')),
          'gpt-5.4-mini': { name: 'gpt-5.4-mini' },
        },
      },
    },
  }),
);

// Same shape the bundle embeds: directory id, frontmatter name/description, markdown body.
const skills = readdirSync(join(pkg, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const raw = readFileSync(join(pkg, 'skills', entry.name, 'SKILL.md'), 'utf8');
    const [, front, body] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
    const field = (key) => new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(front)[1].trim();
    return {
      id: entry.name,
      name: field('name'),
      description: field('description'),
      content: body.trim(),
    };
  });
writeFileSync(join(root, 'skills.json'), JSON.stringify(skills));

const bridgeLog = join(root, 'bridge.log');
writeFileSync(bridgeLog, '');
const bridgeCalls = {
  get length() {
    return this.all.length;
  },
  get all() {
    return readFileSync(bridgeLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  },
  0: undefined,
};
Object.defineProperty(bridgeCalls, 0, { get: () => bridgeCalls.all[0] });

const env = {
  ...process.env,
  E2E_SKILLS_FILE: join(root, 'skills.json'),
  SCHOOL_BOT_APPS_SCRIPT_URL: `http://127.0.0.1:${PORT.bridge}/exec`,
  BRIDGE_PORT: String(PORT.bridge),
  PWD: root,
  MOCK_KEY: 'x',
  MOCK_PORT: String(PORT.mock),
  OPENCODE_DISABLE_AUTOUPDATE: '1',
  OPENCODE_PASSWORD: 'e2e-pass',
  XDG_DATA_HOME: join(root, 'xdg/data'),
  XDG_CONFIG_HOME: join(root, 'xdg/config'),
  XDG_STATE_HOME: join(root, 'xdg/state'),
  XDG_CACHE_HOME: join(root, 'xdg/cache'),
};
const spawned = [];
const start = (cmd, args, extra = {}) => {
  const child = spawn(cmd, args, {
    env: { ...env, ...extra },
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const s of [child.stdout, child.stderr])
    s.on('data', (d) => debug && process.stderr.write(d));
  spawned.push(child);
};
process.on('exit', () => {
  spawned.forEach((c) => c.kill());
  if (!process.env.E2E_KEEP) rmSync(root, { recursive: true, force: true });
});

const lines = (out) =>
  out.split('\n').flatMap((l) => {
    try {
      return [JSON.parse(l)];
    } catch {
      return l.includes('permission requested') ? [{ part: { type: 'note', text: l } }] : [];
    }
  });
function run(args) {
  try {
    return lines(
      execFileSync(
        OC,
        [
          'run',
          '--server',
          `http://127.0.0.1:${PORT.serve}`,
          '--model',
          'openai/gpt-6.2-sol',
          '--format',
          'json',
          ...args,
        ],
        { env, cwd: root, encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    );
  } catch (e) {
    return lines(String(e.stdout ?? '') + String(e.stderr ?? ''));
  }
}
const tool = (evs) => evs.map((e) => e.part).find((p) => p?.type === 'tool');
const text = (evs) =>
  evs
    .map((e) => e.part)
    .filter((p) => p?.type === 'text')
    .map((p) => p.text)
    .join('');
const api = (path) =>
  fetch(`http://127.0.0.1:${PORT.serve}${path}`, { headers: auth }).then((r) => r.json());

start('node', [join(here, 'mock-model.mjs')]);
start('node', [join(here, 'bridge.mjs')], { BRIDGE_LOG: bridgeLog });
start(OC, ['serve', '--hostname', '127.0.0.1', '--port', String(PORT.serve)]);
for (let i = 0; i < 60; i++) {
  if (
    await fetch(`http://127.0.0.1:${PORT.serve}/api/agent?all=true`, { headers: auth })
      .then((r) => r.ok)
      .catch(() => false)
  )
    break;
  await sleep(500);
}
for (let i = 0; i < 40; i++) {
  if (
    !/Agent not found|Model unavailable|Could not reach/.test(
      JSON.stringify(run(['--agent', 'jaew', 'hello'])),
    )
  )
    break;
  await sleep(500);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + detail}`);
};
const sample = JSON.parse(readFileSync(join(pkg, 'test/fixtures/assessment-sample.json'), 'utf8'));
const broken = structuredClone(sample);
broken.questions[0].correctChoiceId = 'c1';

const offered = (agent) =>
  text(run(['--agent', agent, 'hello']))
    .replace(/^TOOLS /, '')
    .split(',')
    .filter(Boolean);
const expected = {
  jaew: ['memory_search', 'memory_save', 'task_status', 'subagent'],
  jum: [
    'memory_search',
    'curriculum_lookup',
    'old_exam_search',
    'check_assessment',
    'save_assessment',
    'fraction_addition_form',
    'make_file',
  ],
  jeng: [
    'memory_search',
    'search_proj14',
    'make_slides',
    'make_sheet',
    'school_theme',
    'check_assessment',
    'save_assessment',
  ],
  porn: [
    'memory_search',
    'read_budget',
    'calc',
    'fill_claim_form',
    'submit_for_approval',
    'send_email',
  ],
  nun: ['get_scores', 'memory_search', 'calc'],
  rungchao: [
    'get_school_summary',
    'read_budget',
    'list_pending_approvals',
    'teacher_activity',
    'memory_search',
    'publish_brief',
  ],
  lekha_por: [
    'list_pending_approvals',
    'get_approval',
    'decide_approval',
    'get_school_summary',
    'read_budget',
    'memory_search',
    'memory_save',
  ],
};
console.log('# every agent answers and is offered exactly its own tools');
for (const [agent, want] of Object.entries(expected)) {
  const got = offered(agent).filter((t) => t !== 'skill');
  check(
    `${agent} answers and is offered ${want.length} tools`,
    got.length > 0 && [...got].sort().join() === [...want].sort().join(),
    got.join(','),
  );
}

console.log('# unbound tools are denied');
let ev = run(['--agent', 'nun', 'CALL save_assessment {}']);
check('nun is not offered save_assessment', /NOT_OFFERED save_assessment/.test(text(ev)), text(ev));
ev = run(['--agent', 'nun', 'FORCE save_assessment {}']);
check(
  'a forced call to an unbound tool is rejected by opencode',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'jaew', 'FORCE bash {"command":"ls"}']);
check(
  'shell is rejected for the secretary',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'jum', 'FORCE get_scores {}']);
check(
  'jum cannot read scores',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'build', 'hello']);
check(
  'opencode built-in agents are removed',
  ev.some((e) => /Agent not found/.test(JSON.stringify(e))),
  JSON.stringify(ev).slice(0, 160),
);

console.log('# real tools through opencode');
ev = run(['--agent', 'nun', 'CALL get_scores {}']);
const scores = JSON.parse((tool(ev)?.state?.output ?? '{}').split('\n')[0]);
if (debug)
  console.error('SCORES OUTPUT TAIL', JSON.stringify((tool(ev)?.state?.output ?? '').slice(-200)));
check(
  'nun gets class scores computed by code',
  scores.n === 20 && scores.mean === 6.8 && scores.belowThreshold?.length === 3,
  (tool(ev)?.state?.output ?? '').slice(0, 120),
);
ev = run(['--agent', 'porn', 'CALL calc {"expr":"120*5+0.5"}']);
check(
  'porn calc is exact',
  (tool(ev)?.state?.output ?? '').includes('1201/2'),
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'porn', 'CALL send_email {"to":"x@y.z","subject":"s","body":"b"}']);
check(
  'send_email needs approval and is rejected when nobody can approve',
  tool(ev)?.state?.status === 'error' && /cannot ask/.test(tool(ev)?.state?.error ?? ''),
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'jum', `CALL check_assessment ${JSON.stringify(broken)}`]);
check(
  'jum check_assessment rejects a wrong key',
  (tool(ev)?.state?.output ?? '').includes('wrong_key'),
  JSON.stringify(tool(ev)?.state).slice(0, 200),
);
ev = run(['--agent', 'jum', `CALL save_assessment ${JSON.stringify(broken)}`]);
check(
  'jum save_assessment refuses a wrong key',
  tool(ev)?.state?.status === 'error' &&
    !(tool(ev)?.state?.output ?? '').includes('docs.google.com') &&
    bridgeCalls.length === 0,
  JSON.stringify(tool(ev)?.state).slice(0, 200),
);
ev = run(['--agent', 'jum', `CALL save_assessment ${JSON.stringify(sample)}`]);
const saved = tool(ev)?.state?.output ?? '';
check(
  'jum save_assessment posts the verified set to the bridge and returns its Google Form link with the published order',
  saved.includes('docs.google.com/forms/d/form_e2e_1') &&
    saved.includes('apps-script') &&
    bridgeCalls.length === 1 &&
    bridgeCalls[0].questions.length === 10 &&
    saved.includes('"answer":"') &&
    bridgeCalls[0].questions[0].choices[bridgeCalls[0].questions[0].answerIndex] === '3/4',
  String(tool(ev)?.state?.error ?? '') + ' | bridge calls ' + bridgeCalls.length,
);

console.log('# skills');
const skillAsk = (agent, id) => run(['--agent', agent, `CALL skill ${JSON.stringify({ id })}`]);
ev = skillAsk('jum', 'worksheet');
const loaded = tool(ev)?.state?.output ?? '';
check(
  'jum can load its bound skill and receives the skill text',
  tool(ev)?.state?.status === 'completed' &&
    loaded.includes(skills.find((x) => x.id === 'worksheet').content.slice(0, 40)),
  JSON.stringify(tool(ev)?.state).slice(0, 300),
);
ev = skillAsk('nun', 'worksheet');
check(
  'nun cannot load a skill it is not bound to',
  tool(ev)?.state?.status === 'error' ||
    !(tool(ev)?.state?.output ?? '').includes(
      skills.find((x) => x.id === 'worksheet').content.slice(0, 40),
    ),
  JSON.stringify(tool(ev)?.state).slice(0, 300),
);
ev = skillAsk('jaew', 'worksheet');
check(
  'jaew has no skills',
  tool(ev)?.state?.status === 'error' || !(tool(ev)?.state?.output ?? '').includes('worksheet'),
  JSON.stringify(tool(ev)?.state).slice(0, 300),
);

console.log('# principal agents');
ev = run(['--agent', 'rungchao', 'CALL get_school_summary {}']);
const summaryOut = tool(ev)?.state?.output ?? '';
check(
  'rungchao reads the school summary with no student-level data',
  summaryOut.includes('ป.6/1') && !/นักเรียนตัวอย่าง|studentId|displayName/.test(summaryOut),
  summaryOut.slice(0, 200),
);
ev = run(['--agent', 'rungchao', 'CALL get_scores {}']);
check(
  'rungchao is not offered per-student scores',
  /NOT_OFFERED get_scores/.test(text(ev)),
  text(ev),
);
ev = run(['--agent', 'rungchao', 'FORCE decide_approval {"approvalId":"x","decision":"approve"}']);
check(
  'rungchao cannot decide approvals',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'lekha_por', 'CALL decide_approval {"approvalId":"x","decision":"approve"}']);
check(
  'decide_approval asks the principal and is rejected when nobody can answer',
  tool(ev)?.state?.status === 'error' && /cannot ask/.test(tool(ev)?.state?.error ?? ''),
  JSON.stringify(tool(ev)?.state),
);
ev = run([
  '--auto',
  '--agent',
  'lekha_por',
  'CALL decide_approval {"approvalId":"x","decision":"return"}',
]);
check(
  'a return without a reason is refused by the tool',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run([
  '--auto',
  '--agent',
  'lekha_por',
  'FORCE subagent {"agent":"jum","description":"x","prompt":"x"}',
]);
check(
  'lekha_por cannot start a teacher agent',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run(['--agent', 'lekha_por', 'FORCE send_email {"to":"a","subject":"s","body":"b"}']);
check(
  'lekha_por cannot send email',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);

console.log('# approval line: porn -> principal');
ev = run([
  '--auto',
  '--agent',
  'porn',
  'CALL fill_claim_form {"budgetCode":"M-01","purpose":"กระดาษ","items":[{"name":"A4","qty":10,"unitPrice":120}]}',
]);
const claimOut = JSON.parse((tool(ev)?.state?.output ?? '{}').split('\n')[0]);
check(
  'porn fills a claim with code-computed totals',
  claimOut.total === 1200 && claimOut.remainingAfter === 2400,
  JSON.stringify(claimOut).slice(0, 160),
);
check(
  'publish_brief rejects an 8-line brief',
  (() => {
    const evb = run([
      '--agent',
      'rungchao',
      `CALL publish_brief ${JSON.stringify({ text: Array(8).fill('บรรทัด').join('\n') })}`,
    ]);
    return (
      tool(evb)?.state?.status === 'error' &&
      /brief_rejected|too_many_lines/.test(JSON.stringify(tool(evb)?.state))
    );
  })(),
);
check(
  'publish_brief rejects a student name',
  (() => {
    const evb = run([
      '--agent',
      'rungchao',
      'CALL publish_brief {"text":"นักเรียนตัวอย่าง 07 ต้องติว"}',
    ]);
    return tool(evb)?.state?.status === 'error';
  })(),
);
check(
  'publish_brief accepts a clean brief',
  (() => {
    const evb = run([
      '--agent',
      'rungchao',
      `CALL publish_brief ${JSON.stringify({ text: 'สรุปเช้าวันเสาร์\n1. ม.2/1 หัวข้อพีทาโกรัสต่ำกว่าเกณฑ์' })}`,
    ]);
    return tool(evb)?.state?.status === 'completed';
  })(),
);

console.log('# access matrix: ask gates, delegation and the principal team');
const asked = [
  ['porn', 'submit_for_approval', '{"claimId":"claim-x"}'],
  ['porn', 'send_email', '{"to":"a@b.c","subject":"s","body":"b"}'],
  ['lekha_por', 'decide_approval', '{"approvalId":"x","decision":"approve"}'],
];
for (const [agent, name, args] of asked) {
  const evAsk = run(['--agent', agent, `CALL ${name} ${args}`]);
  check(
    `${agent} ${name} is a human-confirm gate and is rejected when nobody can press confirm`,
    tool(evAsk)?.state?.status === 'error' && /cannot ask/.test(tool(evAsk)?.state?.error ?? ''),
    JSON.stringify(tool(evAsk)?.state),
  );
}
for (const agent of ['jum', 'jeng', 'porn', 'nun', 'rungchao', 'lekha_por']) {
  const evSub = run([
    '--auto',
    '--agent',
    agent,
    'FORCE subagent {"agent":"jum","description":"x","prompt":"x"}',
  ]);
  check(
    `${agent} cannot delegate (only jaew can)`,
    tool(evSub)?.state?.status === 'error',
    JSON.stringify(tool(evSub)?.state),
  );
}
for (const agent of ['rungchao', 'lekha_por']) {
  for (const name of ['get_scores', 'get_class_scores', 'save_assessment', 'send_email']) {
    const evNo = run(['--auto', '--agent', agent, `FORCE ${name} {}`]);
    check(
      `${agent} cannot call ${name}`,
      tool(evNo)?.state?.status === 'error',
      JSON.stringify(tool(evNo)?.state),
    );
  }
}
const principalOut = [
  run(['--agent', 'lekha_por', 'CALL list_pending_approvals {}']),
  run(['--agent', 'lekha_por', 'CALL get_school_summary {}']),
  run(['--agent', 'rungchao', 'CALL teacher_activity {}']),
  run(['--agent', 'rungchao', 'CALL read_budget {}']),
]
  .map((evs) => tool(evs)?.state?.output ?? '')
  .join('\n');
check(
  'the principal team sees no student-level data through any tool',
  principalOut.length > 100 &&
    !/นักเรียนตัวอย่าง|studentId|displayName|"s-\d\d"/.test(principalOut),
  principalOut.slice(0, 200),
);

console.log('# fraction_addition_form is a fallback only');
const sessionOf = (evs) => evs.find((e) => e.sessionID)?.sessionID;
const inSession = (sid, text2) => run(['--agent', 'jum', '--session', sid, text2]);
let evF = run(['--agent', 'jum', 'CALL fraction_addition_form {"count":3}']);
const fallbackSession = sessionOf(evF);
check(
  'fraction_addition_form is refused before any failed check',
  tool(evF)?.state?.status === 'error' &&
    /fallback_not_allowed|ให้เขียนโจทย์เอง/.test(JSON.stringify(tool(evF)?.state)),
  JSON.stringify(tool(evF)?.state),
);
inSession(fallbackSession, `CALL check_assessment ${JSON.stringify(broken)}`);
evF = inSession(fallbackSession, 'CALL fraction_addition_form {"count":3}');
check(
  'it is still refused after one failed check',
  tool(evF)?.state?.status === 'error' && /ให้เขียนโจทย์เอง/.test(JSON.stringify(tool(evF)?.state)),
  JSON.stringify(tool(evF)?.state),
);
inSession(fallbackSession, `CALL check_assessment ${JSON.stringify(broken)}`);
evF = inSession(fallbackSession, 'CALL fraction_addition_form {"count":3}');
check(
  'it runs after two failed checks in the same session and returns a real Google Form link',
  tool(evF)?.state?.status === 'completed' &&
    (tool(evF)?.state?.output ?? '').includes('docs.google.com/forms/d/form_e2e_1'),
  JSON.stringify(tool(evF)?.state).slice(0, 300),
);
evF = run(['--agent', 'jum', 'CALL fraction_addition_form {"count":3}']);
check(
  'a different session cannot borrow those failures',
  tool(evF)?.state?.status === 'error' && /ให้เขียนโจทย์เอง/.test(JSON.stringify(tool(evF)?.state)),
  JSON.stringify(tool(evF)?.state),
);

console.log('# secretary delegates');
const sessionsOf = async (agent) =>
  ((await api('/api/session')).data ?? []).filter((x) => x.agent === agent);
const messagesOf = async (id) => (await api(`/api/session/${id}/message`)).data ?? [];
const assistantText = (msgs) =>
  msgs
    .filter((m) => m.type === 'assistant')
    .flatMap((m) => m.content)
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
async function delegate(agent, prompt) {
  const before = new Set((await sessionsOf(agent)).map((x) => x.id));
  const ev2 = run([
    '--auto',
    '--agent',
    'jaew',
    `CALL subagent ${JSON.stringify({ agent, description: 'งาน', prompt })}`,
  ]);
  let child;
  for (let i = 0; i < 40 && !child; i++) {
    await sleep(500);
    const fresh = (await sessionsOf(agent)).filter((x) => !before.has(x.id));
    if (fresh[0] && (await messagesOf(fresh[0].id)).some((m) => m.type === 'idle'))
      child = fresh[0];
  }
  return { ev: ev2, child, msgs: child ? await messagesOf(child.id) : [] };
}
let d = await delegate('jum', 'hello');
check(
  'jaew starts jum as a subagent and the child runs under jum',
  tool(d.ev)?.tool === 'subagent' && tool(d.ev)?.state?.status === 'completed' && !!d.child,
  JSON.stringify(tool(d.ev)?.state),
);
const childTools = assistantText(d.msgs);
check(
  'the jum child is offered jum’s own tools including check_assessment',
  childTools.includes('check_assessment') &&
    childTools.includes('save_assessment') &&
    !childTools.includes('memory_save') &&
    !childTools.includes('subagent'),
  childTools,
);
d = await delegate('jum', `CALL check_assessment ${JSON.stringify(sample)}`);
check(
  'the jum child runs check_assessment and gets ok:true',
  JSON.stringify(d.msgs).includes('check_assessment') &&
    JSON.stringify(d.msgs).includes('\\"ok\\":true'),
  JSON.stringify(d.msgs).slice(0, 200),
);
const childSkill = await delegate('jum', `CALL skill ${JSON.stringify({ id: 'worksheet' })}`);
check(
  'the jum child session loads the worksheet skill (bound skills reach delegated sessions)',
  JSON.stringify(childSkill.msgs).includes(
    skills.find((x) => x.id === 'worksheet').content.slice(0, 20),
  ),
  JSON.stringify(childSkill.msgs).slice(0, 300),
);
for (const worker of ['jeng', 'porn', 'nun']) {
  d = await delegate(worker, 'hello');
  check(`jaew can start ${worker}`, !!d.child, JSON.stringify(tool(d.ev)?.state));
}
ev = run([
  '--auto',
  '--agent',
  'jaew',
  `CALL subagent ${JSON.stringify({ agent: 'jaew', description: 'x', prompt: 'x' })}`,
]);
check(
  'jaew cannot start itself',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run([
  '--auto',
  '--agent',
  'jaew',
  `CALL subagent ${JSON.stringify({ agent: 'explore', description: 'x', prompt: 'x' })}`,
]);
check(
  'jaew cannot start a built-in agent',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);
ev = run([
  '--auto',
  '--agent',
  'jum',
  'FORCE subagent {"agent":"nun","description":"x","prompt":"x"}',
]);
check(
  'a worker cannot start other agents',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);

console.log('# lesson preparation line (jaew -> nun with a room, then ask before doing)');
ev = run(['--agent', 'jaew', 'CALL skill {"id":"lesson-prep"}']);
check(
  'jaew loads the lesson-prep skill',
  tool(ev)?.state?.status === 'completed' && (tool(ev)?.state?.output ?? '').includes('เตรียมสอน'),
  JSON.stringify(tool(ev)?.state).slice(0, 200),
);
ev = run(['--agent', 'nun', 'CALL get_scores {"classLabel":"ม.2/1"}']);
const m21 = JSON.parse((tool(ev)?.state?.output ?? '{}').split('\n')[0]);
check(
  'nun reads ม.2/1 with numbers computed by code',
  m21.label === 'ม.2/1' && m21.n === 8 && m21.mean === 3.5 && m21.belowThreshold?.length === 2,
  JSON.stringify(m21).slice(0, 200),
);
ev = run(['--agent', 'nun', 'CALL get_scores {"classLabel":"ม.2/2"}']);
check(
  'a taught room with no past scores says so and carries no numbers',
  (tool(ev)?.state?.output ?? '').includes('"hasData":false') &&
    !(tool(ev)?.state?.output ?? '').includes('"mean"'),
  JSON.stringify(tool(ev)?.state).slice(0, 200),
);
ev = run(['--agent', 'nun', 'CALL get_scores {"classLabel":"ม.6/9"}']);
check(
  'a room the teacher does not teach is refused and the teacher’s rooms are listed',
  tool(ev)?.state?.status === 'error' && /ป\.5\/2/.test(JSON.stringify(tool(ev)?.state)),
  JSON.stringify(tool(ev)?.state).slice(0, 200),
);
d = await delegate('nun', 'CALL get_scores {"classLabel":"ม.2/1"}');
check(
  'the nun child session started by jaew reads the requested room',
  JSON.stringify(d.msgs).includes('\\"mean\\":3.5') && JSON.stringify(d.msgs).includes('ม.2/1'),
  JSON.stringify(d.msgs).slice(0, 300),
);
ev = run(['--agent', 'jaew', 'FORCE get_scores {"classLabel":"ม.2/1"}']);
check(
  'jaew cannot read scores itself',
  tool(ev)?.state?.status === 'error',
  JSON.stringify(tool(ev)?.state),
);

console.log(
  results.every(Boolean)
    ? `\nall ${results.length} passed`
    : `\n${results.filter((r) => !r).length} of ${results.length} FAILED`,
);
process.exit(results.every(Boolean) ? 0 : 1);
