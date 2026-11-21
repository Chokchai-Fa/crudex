/** Thai score wording built by code so the model never drops the unit, e.g. "28/48 คะแนน (8 คน คนละ 6 คะแนน) เฉลี่ย 3.5/6". */
export function scoreLabel({ total, n, maxScore }: { total: number; n: number; maxScore: number }) {
  const mean = n ? Math.round((total / n) * 100) / 100 : 0;
  return `${total}/${n * maxScore} คะแนน (${n} คน คนละ ${maxScore} คะแนน) เฉลี่ย ${mean}/${maxScore}`;
}
