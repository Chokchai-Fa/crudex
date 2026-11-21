// One list for every grade the tools know. Sources: indicators.ts (ป.5) and indicators-m2.ts (ม.2),
// both copied from the สพฐ. 2560 curriculum PDF. Never add codes that are not in those files.
import { indicators, topics, type Indicator } from './indicators';
import { indicatorsM2, topicsM2 } from './indicators-m2';

export interface CurriculumTopic {
  topic: string;
  indicator: string;
  grade: string;
}

export const curriculumIndicators: readonly Indicator[] = [...indicators, ...indicatorsM2];

export const curriculumTopics: readonly CurriculumTopic[] = [
  ...topics,
  ...topicsM2.map(({ name, indicator }) => ({ topic: name, indicator, grade: 'ม.2' })),
];
