import { z } from 'zod';
import { classHistories, studentIdentity, type ClassHistory } from '../data/class-history';
import { classesOf, normalizeClassLabel } from '../data/accounts';
import { pastAssessments, type PastAssessment } from '../data/class-score-history';
import { getFormResponses } from '../lib/form-responses';
import { scoreLabel } from '../lib/score-label';
import { latestForm, type FormRecord } from '../state';
import { classOf, ownerOf, ToolError } from './identity';
import { validatedTool } from './validated';

type ScoredHistory = ClassHistory & { studentIdentities?: ReturnType<typeof studentIdentity>[] };
type FormHistory = PastAssessment & ScoredHistory;

const formSource = 'ตัวอย่าง: คำตอบทดสอบจาก Google Form';

async function readFormHistory(
  form: FormRecord,
  sample: ClassHistory | undefined,
  signal: AbortSignal,
): Promise<{ latest: FormHistory } | { note: string }> {
  const endpoint = process.env.SCHOOL_BOT_APPS_SCRIPT_URL;
  if (!endpoint) return { note: 'ยังไม่ได้เชื่อมต่อ Google Form ใช้ข้อมูลตัวอย่าง' };
  const reply = await getFormResponses({
    endpoint,
    formId: form.formId,
    questionCount: form.questionTopics.length,
    signal,
  });
  if (!reply) return { note: 'อ่านคำตอบจาก Google Form ไม่ได้ ใช้ข้อมูลตัวอย่าง' };
  const { rows } = reply;
  if (!rows.length) return { note: 'ยังไม่มีคำตอบจาก Google Form ใช้ข้อมูลตัวอย่าง' };

  const roster = new Map(
    sample?.results.map((_, index) => {
      const { studentId, displayName } = studentIdentity(index);
      return [studentId, displayName];
    }),
  );
  const newest = rows.reduce(
    (max, { submittedAt }) => Math.max(max, submittedAt.getTime()),
    -Infinity,
  );
  return {
    latest: {
      assessment: {
        assessmentId: `form:${form.formId}`,
        title: `${formSource} – ${form.title}`,
        topic: form.topic,
        maxScore: form.maxScore,
      },
      questionTopics: form.questionTopics,
      results: rows.map(({ result }) => result),
      studentIdentities: rows.map(({ studentId }) => ({
        studentId,
        displayName: roster.get(studentId) ?? studentId,
      })),
      date: new Date(newest).toISOString().slice(0, 10),
    },
  };
}

function countTopics(
  row: string,
  questionTopics: ClassHistory['questionTopics'],
  counts = new Map<string, { wrong: number; total: number }>(),
) {
  [...row].forEach((answer, index) => {
    const topic = questionTopics[index];
    if (topic === undefined) return;
    const count = counts.get(topic) ?? { wrong: 0, total: 0 };
    count.total++;
    if (answer === 'x') count.wrong++;
    counts.set(topic, count);
  });
  return counts;
}

function summarize({ assessment, questionTopics, results, studentIdentities }: ScoredHistory) {
  const threshold = assessment.maxScore * 0.5;
  const byTopic = new Map<string, { wrong: number; total: number }>();
  const students = results.map((row, index) => {
    countTopics(row, questionTopics, byTopic);
    const wrong = countTopics(row, questionTopics);
    return {
      ...(studentIdentities?.[index] ?? studentIdentity(index)),
      score: [...row].filter((answer) => answer === '1').length,
      wrongTopics: [...wrong].filter(([, v]) => v.wrong > 0).map(([topic, v]) => ({ topic, ...v })),
    };
  });
  const total = students.reduce((sum, s) => sum + s.score, 0);
  return {
    ...assessment,
    threshold,
    n: students.length,
    mean: Math.round((total / students.length) * 100) / 100,
    meanLabel: `${Math.round((total / students.length) * 100) / 100}/${assessment.maxScore} คะแนน`,
    scoreLabel: scoreLabel({ total, n: students.length, maxScore: assessment.maxScore }),
    wrongByTopic: [...byTopic]
      .map(([topic, v]) => ({
        topic,
        ...v,
        wrongRate: Math.round((v.wrong / v.total) * 1000) / 1000,
      }))
      .sort((a, b) => b.wrongRate - a.wrongRate),
    belowThreshold: students
      .filter((s) => s.score < threshold)
      .map(({ studentId, displayName, score }) => ({ studentId, displayName, score })),
    students,
  };
}

/** Short summary of every past assessment (oldest first) and students below threshold in two or more. */
function historyOf(classId: string, latest?: FormHistory) {
  const past: readonly PastAssessment[] = pastAssessments[classId] ?? [];
  const below = new Map<string, { studentId: string; displayName: string; times: number }>();
  const history = (latest ? [...past, latest] : past).map((item) => {
    const s = summarize(item);
    const seen = new Set<string>();
    for (const { studentId, displayName } of s.belowThreshold) {
      if (seen.has(studentId)) continue;
      seen.add(studentId);
      const entry = below.get(studentId) ?? { studentId, displayName, times: 0 };
      entry.times++;
      below.set(studentId, entry);
    }
    return {
      assessmentId: s.assessmentId,
      date: item.date,
      title: s.title,
      topic: s.topic,
      indicator: s.indicator,
      maxScore: s.maxScore,
      n: s.n,
      mean: s.mean,
      meanLabel: s.meanLabel,
      scoreLabel: s.scoreLabel,
      belowThresholdCount: s.belowThreshold.length,
      wrongByTopic: s.wrongByTopic,
    };
  });
  return {
    history,
    repeatedlyBelowThreshold: [...below.values()]
      .filter((s) => s.times >= 2)
      .sort((a, b) => b.times - a.times || a.studentId.localeCompare(b.studentId)),
  };
}

export const getScores = validatedTool(z.strictObject({ classLabel: z.string().optional() }), {
  name: 'get_scores',
  description:
    'ดูคะแนนของห้องที่ครูสอน mode form คือคำตอบทดสอบจาก Google Form ล่าสุด และ mode sample คือข้อมูลตัวอย่างพร้อมเหตุผล ระบุ classLabel เป็นชื่อห้อง เช่น ม.2/1 หรือรหัสห้องได้ ถ้าไม่ระบุจะใช้ห้องในเซสชันหรือห้องแรกที่ครูสอน คืนค่าเฉลี่ย รายชื่อต่ำกว่าเกณฑ์ (ต่ำกว่า 50% ของคะแนนเต็ม ระบบตั้ง) หัวข้อที่ผิดมากสุด และคะแนนรายคนของครั้งล่าสุด ป้ายคะแนนพร้อมหน่วย (scoreLabel เช่น 28/48 คะแนน (8 คน คนละ 6 คะแนน) เฉลี่ย 3.5/6 ให้ใช้ข้อความนี้ตรงตัวเมื่อสรุปคะแนน) พร้อม history สรุปทุกครั้งที่ผ่านมา (เก่าไปใหม่) และ repeatedlyBelowThreshold นักเรียนที่ต่ำกว่าเกณฑ์ตั้งแต่ 2 ครั้ง ตัวเลขทุกตัวคำนวณโดยระบบ',
  gate: 'allow',
  execute: async ({ classLabel }, context) => {
    const ownerId = ownerOf(context).id;
    const rooms = classesOf(ownerId);
    const sessionClassId = classOf(context);
    const room =
      classLabel !== undefined
        ? rooms.find(
            ({ id, label }) =>
              id === classLabel.trim() ||
              normalizeClassLabel(label) === normalizeClassLabel(classLabel),
          )
        : sessionClassId === undefined
          ? rooms[0]
          : rooms.find(({ id }) => id === sessionClassId);
    if (!room) {
      const labels = rooms.map(({ label }) => label).join(', ');
      throw new ToolError(
        'class_not_taught',
        labels ? `เลือกได้เฉพาะห้องที่ครูสอน ได้แก่ ${labels}` : 'ยังไม่มีห้องที่ครูสอนในระบบ',
      );
    }

    const { id: classId, label } = room;
    const sample = classHistories[classId];
    const form = latestForm(ownerId, classId);
    const result = form
      ? await readFormHistory(form, sample, context.signal)
      : { note: 'ยังไม่มี Google Form ของห้องนี้ ใช้ข้อมูลตัวอย่าง' };
    if ('latest' in result) {
      const { latest } = result;
      return {
        hasData: true,
        classId,
        label,
        mode: 'form',
        source: formSource,
        date: latest.date,
        ...summarize(latest),
        ...historyOf(classId, latest),
      };
    }
    const fallback = { classId, label, mode: 'sample', note: result.note };
    if (!sample) {
      return { hasData: false, ...fallback, message: 'ยังไม่มีข้อมูลคะแนนของห้องนี้' };
    }
    return { hasData: true, ...fallback, ...summarize(sample), ...historyOf(classId) };
  },
});
