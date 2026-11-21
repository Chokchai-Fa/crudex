import { expect, it } from 'vitest';
import type { RunEvent } from '@repo/shared';
import { kahootHandoff, kahootOwnerSummary } from './kahoot-handoff-result';

const delegated: RunEvent = {
  type: 'tool',
  name: 'subagent',
  id: 'delegation:1',
  status: 'success',
  agentId: 'jeng',
};
const url = 'https://create.kahoot.it/creator/example';

it('keeps the legacy three-question worker reply separate from Jaew’s summary', () => {
  const workerReply = `พี่สร้างเกม Kahoot 3 ข้อเรียบร้อยแล้วครับ [เปิด editor](${url})`;
  const result = kahootHandoff([
    delegated,
    { type: 'delta', messageId: 'jaew-summary', text: 'แจ๋วประสานพี่เจ๋งให้แล้วค่ะ' },
    { type: 'delta', messageId: 'reply:jeng-child', text: workerReply },
    { type: 'done', elapsedMs: 100 },
  ]);
  expect(result?.detailIds).toEqual(new Set(['reply:jeng-child']));
  expect(result?.details).toBe(workerReply);
  expect(result?.links).toEqual([url]);
});

it('uses the editor link from the root reply when the runtime provides only a summary', () => {
  const result = kahootHandoff([
    { ...delegated },
    { type: 'delta', text: `[เปิดเกม](${url}) หรือ ${url}.` },
  ]);
  expect(result?.links).toEqual([url]);
  expect(result?.detailIds.size).toBe(0);
});

it('keeps failed handoffs visible without inventing a link', () => {
  const result = kahootHandoff([
    { ...delegated, status: 'failed' },
    { type: 'delta', text: 'ยังสร้าง Kahoot ไม่ได้' },
  ]);
  expect(result?.status).toBe('failed');
  expect(result?.links).toEqual([]);
});

it('does not assign unlabelled worker text to Jeng on a mixed handoff', () => {
  const result = kahootHandoff([
    delegated,
    { ...delegated, id: 'delegation:2', agentId: 'jum' },
    { type: 'delta', messageId: 'reply:child', text: 'รายงาน Kahoot' },
  ]);
  expect(result?.detailIds.size).toBe(0);
});

it('requires a handoff to Jeng and evidence that it was for Kahoot', () => {
  expect(kahootHandoff([{ type: 'delta', text: 'เกม Kahoot' }])).toBeUndefined();
  expect(kahootHandoff([delegated, { type: 'delta', text: 'สไลด์เสร็จแล้ว' }])).toBeUndefined();
});

it('can link to Jeng history when the new runtime returns only the title in Jaew’s reply', () => {
  const result = kahootHandoff(
    [delegated, { type: 'delta', text: 'พี่เจ๋งทำเกมสามเหลี่ยมเสร็จแล้วค่ะ' }],
    'ช่วยสร้าง Kahoot 3 ข้อ',
  );
  expect(result?.status).toBe('success');
  expect(result?.links).toEqual([]);
});

it('keeps the title in Jaew’s summary and leaves the editor URL and UUID out', () => {
  expect(
    kahootOwnerSummary(
      `พี่เจ๋งทำเกมสามเหลี่ยมเสร็จแล้วค่ะ
- [เปิด editor](${url})
UUID: 10101010-1010-4110-8110-101010101010`,
    ),
  ).toBe('พี่เจ๋งทำเกมสามเหลี่ยมเสร็จแล้วค่ะ');
});
