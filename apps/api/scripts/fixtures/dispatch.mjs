// Offline gateway stand-in for the HTTP/DB integration suite. Never loaded by a deployed Worker.
import { WorkerEntrypoint } from 'cloudflare:workers';

const assessment = {
  title: 'แบบฝึกหัดเศษส่วน',
  grade: 'ป.4',
  topic: 'เศษส่วน',
  expectedCount: 1,
  questions: [
    {
      id: 'q1',
      text: '1/4 + 1/4 = ?',
      topic: 'เศษส่วน',
      choices: [
        { id: 'a', text: '1/2' },
        { id: 'b', text: '1/4' },
        { id: 'c', text: '1/8' },
        { id: 'd', text: '3/4' },
      ],
      correctChoiceId: 'a',
      verify: { expr: '1/4 + 1/4', expected: '1/2' },
    },
  ],
};

export class SchoolDispatch extends WorkerEntrypoint {
  async fetch(request) {
    const { scope, text } = await request.json();
    if (text.endsWith('Test delegated Kahoot history')) {
      const receipt = {
        type: 'delegated_kahoot',
        agentId: 'jeng',
        childSessionId: 'ses_private_fixture',
        status: 'created',
        title: 'Fractions',
        kahootId: 'fixture',
        text: 'Fixture Kahoot ready',
      };
      return new Response(
        [receipt, receipt, { type: 'done', elapsedMs: 1 }]
          .map((e) => 'data: ' + JSON.stringify(e) + '\n\n')
          .join(''),
      );
    }
    if (text.endsWith('Can you explain equivalent fractions?')) {
      const events = [
        { type: 'delta', text: 'One half equals two quarters.' },
        { type: 'done', elapsedMs: 1 },
      ];
      return new Response(events.map((e) => 'data: ' + JSON.stringify(e) + '\n\n').join(''), {
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    const callback = 'http://localhost/api/internal/runs/' + scope.runId + '/tools/save_assessment';
    const save = () =>
      this.env.SCHOOL_API.fetch(callback, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer ' + scope.credential,
        },
        body: JSON.stringify({ assessment, invocationId: 'worksheet-1' }),
      });
    const results = await Promise.all([save(), save()]);
    if (results.some((result) => !result.ok))
      throw new Error('Worksheet callback returned an error');
    const [first, second] = await Promise.all(results.map((result) => result.json()));
    if (first.id !== second.id) throw new Error('Worksheet callback created two assessments');
    const events = [
      { type: 'tool', id: 'worksheet-1', name: 'save_assessment', status: 'success' },
      { type: 'delta', text: 'บันทึกแบบฝึกหัดแล้ว' },
      { type: 'done', elapsedMs: 1 },
    ];
    return new Response(events.map((e) => 'data: ' + JSON.stringify(e) + '\n\n').join(''), {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
export default {
  fetch() {
    return new Response(null, { status: 404 });
  },
};
