import assert from 'node:assert/strict';
import test from 'node:test';
import { publicRunText } from '../src/features/school/public-run-text.ts';

test('an identified model reply grows while the run is still open', () => {
  const events = [{ type: 'delta', messageId: 'model-1', text: 'One half' }];
  assert.equal(publicRunText(events), 'One half');
  events.push({ type: 'delta', messageId: 'model-1', text: ' equals two quarters.' });
  assert.equal(publicRunText(events), 'One half equals two quarters.');
  events.push({ type: 'done', elapsedMs: 100 });
  assert.equal(publicRunText(events), 'One half equals two quarters.');
});

test('an interim marker keeps the earlier message on screen', () => {
  const events = [
    { type: 'delta', messageId: 'model-1', text: 'ขอดูคะแนนก่อนนะคะ' },
    { type: 'delta', messageId: 'model-1', text: '', interim: true },
    { type: 'tool', name: 'get_scores', id: 'call-1', status: 'started' },
    { type: 'delta', messageId: 'model-2', text: 'ค่าเฉลี่ย 3.5/6 คะแนนค่ะ' },
  ];
  assert.equal(publicRunText(events), 'ขอดูคะแนนก่อนนะคะ\n\nค่าเฉลี่ย 3.5/6 คะแนนค่ะ');
});

test('separates messages once without doubling a break the runtime already sent', () => {
  assert.equal(
    publicRunText([
      { type: 'delta', messageId: 'model-1', text: 'One' },
      { type: 'delta', messageId: 'model-2', text: '\n\nTwo' },
      { type: 'delta', messageId: 'model-3', text: 'Three' },
    ]),
    'One\n\nTwo\n\nThree',
  );
});

test('a reply without message IDs stays one message', () => {
  assert.equal(
    publicRunText([
      { type: 'delta', text: 'One ' },
      { type: 'delta', text: 'half' },
    ]),
    'One half',
  );
});
