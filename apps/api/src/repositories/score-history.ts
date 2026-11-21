import type { AssessmentContent } from '@repo/shared';

type Row = {
  assessmentId: string;
  content: AssessmentContent;
  date: string;
  answers: Record<string, string>;
  score: number;
  studentId: string;
};

export function summarizeScores(classId: string, label: string, rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const group = groups.get(row.assessmentId) ?? [];
    group.push(row);
    groups.set(row.assessmentId, group);
  }
  const times = new Map<string, number>();
  const results = [...groups.values()].map((group) => {
    const first = group[0]!;
    const { questions, title, topic } = first.content;
    const maxScore = questions.length;
    const n = group.length;
    const total = group.reduce((sum, row) => sum + row.score, 0);
    const mean = Math.round((total / n) * 100) / 100;
    const topics = new Map<string, { wrong: number; total: number }>();
    const questionTopics = questions.map((q) => {
      const correct = group.filter((row) => row.answers[q.id] === q.correctChoiceId).length;
      const counts = topics.get(q.topic) ?? { wrong: 0, total: 0 };
      counts.wrong += n - correct;
      counts.total += n;
      topics.set(q.topic, counts);
      return { questionId: q.id, topic: q.topic, correctPercent: (100 * correct) / n };
    });
    const wrongByTopic = [...topics]
      .map(([topic, counts]) => ({
        topic,
        ...counts,
        wrongRate: counts.wrong / counts.total,
        correctPercent: (100 * (counts.total - counts.wrong)) / counts.total,
      }))
      .sort((a, b) => b.wrongRate - a.wrongRate);
    const students = group.map(({ studentId, score }) => ({ studentId, score }));
    const belowThreshold = students.filter((s) => s.score < maxScore / 2);
    for (const s of belowThreshold) times.set(s.studentId, (times.get(s.studentId) ?? 0) + 1);
    const summary = {
      assessmentId: first.assessmentId,
      date: first.date,
      title,
      topic,
      maxScore,
      n,
      mean,
      meanLabel: mean + '/' + maxScore + ' คะแนน',
      scoreLabel:
        total +
        '/' +
        n * maxScore +
        ' คะแนน (' +
        n +
        ' คน คนละ ' +
        maxScore +
        ' คะแนน) เฉลี่ย ' +
        mean +
        '/' +
        maxScore,
      belowThresholdCount: belowThreshold.length,
      wrongByTopic,
    };
    return { summary, students, belowThreshold, questionTopics };
  });
  const latest = results.at(-1);
  if (!latest) return { hasData: false, classId, label, history: [] };
  return {
    hasData: true,
    classId,
    label,
    ...latest.summary,
    threshold: latest.summary.maxScore / 2,
    students: latest.students,
    belowThreshold: latest.belowThreshold,
    questionTopics: latest.questionTopics,
    weakestTopic: latest.summary.wrongByTopic[0],
    history: results.map((r) => r.summary),
    repeatedlyBelowThreshold: [...times]
      .filter(([, count]) => count >= 2)
      .map(([studentId, times]) => ({ studentId, times }))
      .sort((a, b) => b.times - a.times || a.studentId.localeCompare(b.studentId)),
  };
}
