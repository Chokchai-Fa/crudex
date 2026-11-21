import { expect, it } from 'vitest';
import type { RunEvent } from '@repo/shared';
import { kahootHandoff } from './kahoot-handoff-result';

const delegated: RunEvent = {
  type: 'tool',
  name: 'subagent',
  id: 'delegation:1',
  status: 'success',
  agentId: 'jeng',
};

it('uses a persisted handoff to expose the editor link from the root reply', () => {
  const url = 'https://create.kahoot.it/creator/example';
  expect(kahootHandoff([delegated], `[เปิดเกม](${url}) หรือ ${url}.`)).toEqual({
    status: 'success',
    links: [url],
  });
});

it('keeps failed handoffs visible without inventing a link', () => {
  expect(kahootHandoff([{ ...delegated, status: 'failed' }], 'ยังสร้าง Kahoot ไม่ได้')).toEqual({
    status: 'failed',
    links: [],
  });
});

it('requires a handoff to Jeng and evidence that it was for Kahoot', () => {
  expect(kahootHandoff([], 'เกม Kahoot')).toBeUndefined();
  expect(kahootHandoff([{ ...delegated, agentId: 'jum' }], 'เกม Kahoot')).toBeUndefined();
  expect(kahootHandoff([delegated], 'สไลด์เสร็จแล้ว')).toBeUndefined();
});
