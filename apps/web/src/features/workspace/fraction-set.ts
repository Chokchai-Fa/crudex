export const rooms = ['ป.5/1', 'ป.5/2', 'ป.6/1'];

export const exercises = [
  ['1/5 + 2/5', '3/5'],
  ['7/8 − 3/8', '1/2'],
  ['1/2 + 1/4', '3/4'],
  ['5/6 − 1/3', '1/2'],
  ['2/3 + 1/6', '5/6'],
  ['4/5 − 1/2', '3/10'],
  ['1/4 + 3/8', '5/8'],
  ['7/9 − 1/3', '4/9'],
  ['3/10 + 2/5', '7/10'],
  ['11/12 − 1/4', '2/3'],
] as const;

export function answerChoices(answer: string, questionIndex: number, count: number) {
  const alternatives = exercises.map(([, value]) => value).filter((value) => value !== answer);
  const choices = [answer, ...new Set(alternatives)].slice(0, count);
  const offset = questionIndex % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}
