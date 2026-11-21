export interface DailyUsage {
  day: string;
  runs: number;
}

const bangkokDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function bangkokDay(now: number) {
  return bangkokDate.format(now);
}

export function countToday(usage: DailyUsage | undefined, now: number) {
  return usage?.day === bangkokDay(now) ? usage.runs : 0;
}

export function consumeRun(
  usage: DailyUsage | undefined,
  now: number,
  limit: number,
): DailyUsage | null {
  const day = bangkokDay(now);
  const runs = usage?.day === day ? usage.runs : 0;
  return runs < limit ? { day, runs: runs + 1 } : null;
}
