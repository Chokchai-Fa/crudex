import { expect, it } from 'vitest';
import { bangkokDay, consumeRun, countToday } from '../src/daily-cap';

it('counts only admitted runs and resets at midnight in Bangkok', () => {
  const beforeMidnight = Date.parse('2026-01-01T16:59:59.999Z');
  const afterMidnight = beforeMidnight + 1;
  expect(bangkokDay(beforeMidnight)).toBe('2026-01-01');
  expect(bangkokDay(afterMidnight)).toBe('2026-01-02');
  const first = consumeRun(undefined, beforeMidnight, 2);
  const second = consumeRun(first ?? undefined, beforeMidnight, 2);
  expect(second?.runs).toBe(2);
  expect(consumeRun(second ?? undefined, beforeMidnight, 2)).toBeNull();
  expect(countToday(second ?? undefined, afterMidnight)).toBe(0);
  expect(consumeRun(second ?? undefined, afterMidnight, 2)).toEqual({
    day: '2026-01-02',
    runs: 1,
  });
});
