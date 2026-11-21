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

test('a late interim marker retracts only its own message', () => {
  const events = [
    { type: 'delta', messageId: 'model-1', text: 'Checking' },
    { type: 'delta', messageId: 'model-2', text: 'Answer' },
    { type: 'delta', messageId: 'model-1', text: '', interim: true },
    { type: 'delta', messageId: 'model-1', text: ' a tool' },
  ];
  assert.equal(publicRunText(events), 'Answer');
});
