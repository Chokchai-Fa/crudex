import { evalExpr, parseNumberText, show } from './fractions';

export interface PythagoreanRoles {
  legA: number;
  legB: number;
  hypotenuse: number;
  ask: 'legA' | 'legB' | 'hypotenuse';
}

export interface SemanticQuestion {
  id: string;
  text: string;
  topic: string;
  choices: { id: string; text: string }[];
  correctChoiceId: string;
  verify?: { expr: string; expected: string };
  pythagorean?: PythagoreanRoles;
}

export interface SemanticIssue {
  questionId: string;
  code: string;
  message: string;
}

const isPythagorean = (topic: string) => topic.includes('พีทาโกรัส');

/** The arithmetic checker cannot tell which side is the hypotenuse; the roles are declared and checked here. */
export function pythagoreanIssues(question: SemanticQuestion): {
  issues: SemanticIssue[];
  verified: boolean;
} {
  const issue = (code: string, message: string): SemanticIssue => ({
    questionId: question.id,
    code,
    message,
  });
  const roles = question.pythagorean;
  if (!roles) return { issues: [], verified: !isPythagorean(question.topic) };

  const issues: SemanticIssue[] = [];
  const { legA, legB, hypotenuse, ask } = roles;
  if (!(hypotenuse > legA && hypotenuse > legB)) {
    issues.push(
      issue(
        'hypotenuse_not_longest',
        'ด้านตรงข้ามมุมฉากต้องยาวที่สุด ตรวจว่าระบุขากับด้านตรงข้ามมุมฉากถูกด้านหรือไม่',
      ),
    );
  }
  const legs = evalExpr(`${legA}^2+${legB}^2`);
  const longest = evalExpr(`${hypotenuse}^2`);
  if (show(legs) !== show(longest)) {
    issues.push(
      issue(
        'pythagorean_mismatch',
        `ขา ${legA} กับ ${legB} และด้านตรงข้ามมุมฉาก ${hypotenuse} ไม่เป็นไปตาม a²+b²=c²`,
      ),
    );
  }
  const sides = { legA, legB, hypotenuse };
  const asked = sides[ask];
  const inStem = new Set(
    (question.text.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? []).map(Number),
  );
  const given = (Object.keys(sides) as (keyof typeof sides)[])
    .filter((side) => side !== ask)
    .map((side) => sides[side]);
  if (!given.every((value) => inStem.has(value))) {
    issues.push(
      issue('given_side_missing', `โจทย์ต้องบอกความยาว ${given.join(' และ ')} ของด้านที่ให้มา`),
    );
  }
  if (inStem.has(asked)) {
    issues.push(issue('asked_side_in_stem', `โจทย์ไม่ควรมีความยาว ${asked} ซึ่งเป็นด้านที่ถาม`));
  }
  const key = question.choices.find((choice) => choice.id === question.correctChoiceId);
  const keyValue = key ? parseNumberText(key.text) : undefined;
  if (!keyValue || show(keyValue) !== show(evalExpr(String(asked)))) {
    issues.push(issue('answer_not_asked_side', `เฉลยต้องเท่ากับด้านที่ถาม (${ask} = ${asked})`));
  }
  return { issues, verified: issues.length === 0 };
}

const digitsOf = (text: string) => (text.normalize('NFKC').match(/\d+(?:\.\d+)?/g) ?? []).join(',');

/** Same numbers, same question: the expression when there is one, otherwise the numbers in the stem. */
export function questionSignature(question: Pick<SemanticQuestion, 'text' | 'verify'>): string {
  return (question.verify?.expr ?? digitsOf(question.text)).replace(/\s+/g, '');
}

const passedSets = new Map<string, { hash: string; signatures: Set<string> }[]>();

export function resetPassedSets() {
  passedSets.clear();
}

/** Two different sets in one session must not reuse the same numbers (a worksheet and a Form from one request). */
export function reuseIssue(
  sessionKey: string,
  questions: Pick<SemanticQuestion, 'text' | 'verify'>[],
): string | undefined {
  const signatures = questions.map(questionSignature);
  const hash = signatures.join('|');
  const earlier = passedSets.get(sessionKey) ?? [];
  if (earlier.some((set) => set.hash === hash)) return undefined;
  for (const set of earlier) {
    const shared = signatures.filter((signature) => set.signatures.has(signature)).length;
    if (signatures.length >= 3 && shared / signatures.length >= 0.5) {
      return `ชุดนี้ใช้ตัวเลขซ้ำกับชุดก่อนหน้า ${shared} จาก ${signatures.length} ข้อ ให้เปลี่ยนตัวเลขในทุกข้อที่ซ้ำ`;
    }
  }
  passedSets.set(sessionKey, [...earlier, { hash, signatures: new Set(signatures) }]);
  return undefined;
}

const numericValue = (text: string) => {
  const value = parseNumberText(text);
  return value ? show(value) : undefined;
};

/** Distractors must come from mistakes a student really makes, not from a tidy list around the answer. */
export function choiceIssues(question: SemanticQuestion): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const values = question.choices.map((choice) => parseNumberText(choice.text));
  const lengthItem = isPythagorean(question.topic) || question.pythagorean !== undefined;
  if (lengthItem && values.length >= 4 && values.every((value) => value !== undefined)) {
    const sorted = values.map((value) => Number(value!.n) / Number(value!.d)).sort((a, b) => a - b);
    const steps = sorted.slice(1).map((value, i) => Math.round((value - sorted[i]!) * 1e9) / 1e9);
    if (steps.length >= 3 && steps.every((step) => step > 0 && step === steps[0])) {
      issues.push({
        questionId: question.id,
        code: 'evenly_spaced_choices',
        message:
          'ตัวเลือกเรียงห่างเท่ากัน (เช่น 9 10 11 12) ให้เปลี่ยนตัวลวงเป็นค่าที่ได้จากความเข้าใจผิดจริง เช่น บวกความยาวสองด้านเฉยๆ หรือลืมถอดรากที่สอง',
      });
    }
  }
  const roles = question.pythagorean;
  if (roles) {
    const { legA, legB, hypotenuse, ask } = roles;
    const given = { legA, legB, hypotenuse };
    const known = (Object.keys(given) as (keyof typeof given)[])
      .filter((side) => side !== ask)
      .map((side) => given[side]);
    const [x = 0, y = 0] = known;
    const mistakes = new Set(
      [x, y, x + y, Math.abs(x - y), x * x + y * y, Math.abs(x * x - y * y)]
        .map((value) => numericValue(String(value)))
        .filter((value): value is string => value !== undefined),
    );
    const key = question.choices.find((choice) => choice.id === question.correctChoiceId);
    const keyValue = key ? numericValue(key.text) : undefined;
    const hasMistake = question.choices.some((choice) => {
      const value = numericValue(choice.text);
      return (
        choice.id !== question.correctChoiceId &&
        value !== undefined &&
        value !== keyValue &&
        mistakes.has(value)
      );
    });
    if (!hasMistake) {
      issues.push({
        questionId: question.id,
        code: 'no_misconception_distractor',
        message: `ต้องมีตัวลวงอย่างน้อย 1 ข้อที่มาจากความเข้าใจผิดจริง เช่น ${x}+${y}=${x + y}, ${x}^2+${y}^2 โดยไม่ถอดรากที่สอง หรือค่าด้านที่โจทย์ให้มา`,
      });
    }
  }
  return issues;
}
