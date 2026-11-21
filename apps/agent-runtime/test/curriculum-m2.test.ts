import { describe, expect, it } from 'vitest';
import { classHistories } from '../src/data/class-history';
import { runCheck } from '../src/tools/check_assessment';
import { curriculumLookup } from '../src/tools/curriculum_lookup';
import { additionWorksheet } from '../src/tools/fraction_addition_form';

const context = { count: 1, signal: new AbortController().signal };
type Lookup = {
  count: number;
  items: { id: string; grade: string }[];
  topics: { topic: string; indicator: string; grade: string }[];
};
const lookup = async (input: Record<string, string>) =>
  (await curriculumLookup.execute(input, context)) as Lookup;

describe('curriculum_lookup covers ม.2', () => {
  it('finds the Pythagoras indicator and its standard topics', async () => {
    const result = await lookup({ grade: 'ม.2', query: 'พีทาโกรัส' });
    expect(result.items.map((i) => i.id)).toEqual(['ค 2.2 ม.2/5']);
    expect(result.topics.map((t) => t.topic)).toContain('ทฤษฎีบทพีทาโกรัสและบทกลับ');
  });

  it('keeps ป.5 results unchanged and grades separate', async () => {
    const p5 = await lookup({ grade: 'ป.5', query: 'เศษส่วน' });
    expect(p5.items.length).toBeGreaterThan(0);
    expect(p5.items.every((i) => i.grade === 'ป.5')).toBe(true);
    const m2 = await lookup({ grade: 'ม.2' });
    expect(m2.items.every((i) => i.grade === 'ม.2')).toBe(true);
    expect(m2.count).toBe(12);
  });

  it('every ม.2/1 sample score topic is a curriculum topic of the stated indicator', async () => {
    const history = classHistories['class-m2-1'];
    expect(history).toBeDefined();
    const m2 = await lookup({ grade: 'ม.2' });
    for (const topic of new Set(history?.questionTopics)) {
      const match = m2.topics.find((t) => t.topic === topic);
      expect(match, topic).toBeDefined();
      expect(match?.indicator).toBe(history?.assessment.indicator);
    }
  });
});

describe('check_assessment accepts ม.2 codes and rejects invented ones', () => {
  const withIndicator = (indicator: string) => {
    const base = additionWorksheet(1);
    return {
      ...base,
      questions: base.questions.map((q) => ({ ...q, indicator })),
    };
  };

  it('accepts ค 2.2 ม.2/5', () => {
    const { result } = runCheck(withIndicator('ค 2.2 ม.2/5'));
    expect(result.errors.filter((e) => e.code === 'unknown_indicator')).toEqual([]);
  });

  it('rejects ค 2.2 ม.2/9', () => {
    const { result } = runCheck(withIndicator('ค 2.2 ม.2/9'));
    expect(result.errors.map((e) => e.code)).toContain('unknown_indicator');
  });
});
