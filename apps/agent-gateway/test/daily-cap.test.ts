import { expect, it } from 'vitest';
import { bangkokDay, consumeRun, countToday, dailyRunLimit } from '../src/daily-cap';

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

it('admits exactly 150 runs on the demo date and restores the configured limit at midnight', () => {
  const start = Date.parse('2026-11-21T00:00:00+07:00');
  const end = Date.parse('2026-11-22T00:00:00+07:00');
  const configured = 60;
  expect(dailyRunLimit(start - 1, configured)).toBe(configured);
  expect(dailyRunLimit(start, configured)).toBe(150);
  const last = consumeRun({ day: '2026-11-21', runs: 149 }, end - 1, configured);
  expect(last).toEqual({ day: '2026-11-21', runs: 150 });
  expect(consumeRun(last ?? undefined, end - 1, configured)).toBeNull();
  expect(countToday(last ?? undefined, end)).toBe(0);
  expect(dailyRunLimit(end, configured)).toBe(configured);
  expect(consumeRun(last ?? undefined, end, configured)?.runs).toBe(1);
  expect(consumeRun({ day: '2026-11-22', runs: 60 }, end, configured)).toBeNull();
  expect(dailyRunLimit(end, 17)).toBe(17);
});
