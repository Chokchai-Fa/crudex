export interface ArrangedQuestion {
  id: string;
  choices: { id: string; text: string }[];
  answer: 'ก' | 'ข' | 'ค' | 'ง';
}

const LETTERS = ['ก', 'ข', 'ค', 'ง'] as const;

function seeded(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Display order for a worksheet read in chat: no answer position holds more than ceil(n / 4) of the keys.
 * Deterministic for the same set, and it never changes which choice is correct.
 */
export function arrangeAnswers(
  questions: { id: string; choices: { id: string; text: string }[]; correctChoiceId: string }[],
): ArrangedQuestion[] {
  const cap = Math.ceil(questions.length / LETTERS.length);
  const counts = new Array<number>(LETTERS.length).fill(0);
  return questions.map((question) => {
    const random = seeded(
      question.id + '|' + question.choices.map((choice) => choice.text).join('|'),
    );
    const order = [...question.choices];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const current = order.findIndex((choice) => choice.id === question.correctChoiceId);
    const open = counts.flatMap((count, position) =>
      count < cap && position < order.length ? [position] : [],
    );
    const target = open.includes(current)
      ? current
      : (open[Math.floor(random() * open.length)] ?? current);
    if (target !== current) [order[target], order[current]] = [order[current]!, order[target]!];
    counts[target] = (counts[target] ?? 0) + 1;
    return { id: question.id, choices: order, answer: LETTERS[target] ?? 'ก' };
  });
}
