interface Fraction {
  n: bigint;
  d: bigint;
}

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  choices: Choice[];
  correctChoiceId: string;
  topic: string;
  explanation?: string;
  verify?: { expr: string; expected: string };
}

export interface Assessment {
  title: string;
  grade: string;
  topic: string;
  questions: Question[];
}

export interface Finding {
  code: string;
  message: string;
  questionId?: string;
}

export interface CheckResult {
  ok: boolean;
  errors: Finding[];
  verified: string[];
  unverified: string[];
}

export interface CheckOptions {
  expectedCount?: number;
  minQuestions?: number;
}

function fraction(n: bigint, d: bigint): Fraction {
  if (d === 0n) throw new Error('หารด้วยศูนย์ไม่ได้');
  let a = n < 0n ? -n : n;
  let b = d < 0n ? -d : d;
  while (b !== 0n) [a, b] = [b, a % b];
  const divisor = d < 0n ? -a : a;
  return { n: n / divisor, d: d / divisor };
}

function compare(left: Fraction, right: Fraction): bigint {
  return left.n * right.d - right.n * left.d;
}

function decimal(text: string): Fraction {
  const [whole = '', digits = ''] = text.split('.');
  return fraction(BigInt(whole + digits), 10n ** BigInt(digits.length));
}

export function show(value: Fraction): string {
  return value.d === 1n ? String(value.n) : `${value.n}/${value.d}`;
}

const numberPattern = /(?:\d+(?:\.\d*)?|\.\d+)/y;
const comparisonPattern = /^(<=|>=|<|>|=)/;

function normalize(text: string): string {
  return text.replace(/−/g, '-').replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - 0x0e50));
}

const MAX_EXPONENT = 8;

function power(base: Fraction, exponent: number): Fraction {
  return fraction(base.n ** BigInt(exponent), base.d ** BigInt(exponent));
}

function integerRoot(value: bigint): bigint | undefined {
  if (value < 0n) return undefined;
  if (value < 2n) return value;
  let low = 1n;
  let high = value;
  while (low <= high) {
    const mid = (low + high) / 2n;
    const square = mid * mid;
    if (square === value) return mid;
    if (square < value) low = mid + 1n;
    else high = mid - 1n;
  }
  return undefined;
}

/** Exact square root; a value that is not the square of a fraction is an error, never a rounded number. */
function squareRoot(value: Fraction): Fraction {
  const numerator = integerRoot(value.n);
  const denominator = integerRoot(value.d);
  if (numerator === undefined || denominator === undefined) {
    throw new Error('รากที่สองต้องลงตัว ใช้ได้เฉพาะจำนวนที่เป็นกำลังสองสมบูรณ์');
  }
  return fraction(numerator, denominator);
}

class Parser {
  private position = 0;

  constructor(private readonly text: string) {}

  private rest(): string {
    while (/\s/.test(this.text.charAt(this.position))) this.position++;
    return this.text.slice(this.position);
  }

  private take(...tokens: string[]): string | undefined {
    const rest = this.rest();
    const token = tokens.find((candidate) => rest.startsWith(candidate));
    if (token !== undefined) this.position += token.length;
    return token;
  }

  finish(): void {
    if (this.rest()) throw new Error('มีข้อความเกินในนิพจน์');
  }

  expression(): Fraction {
    let left = this.product();
    for (let op = this.take('+', '-'); op; op = this.take('+', '-')) {
      const right = this.product();
      const term = right.n * left.d;
      left = fraction(left.n * right.d + (op === '+' ? term : -term), left.d * right.d);
    }
    return left;
  }

  statement(): boolean {
    const left = this.expression();
    const op = comparisonPattern.exec(this.rest())?.[0];
    if (!op) throw new Error('ต้องมีเครื่องหมายเปรียบเทียบ');
    this.position += op.length;
    const difference = compare(left, this.expression());
    switch (op) {
      case '<':
        return difference < 0n;
      case '>':
        return difference > 0n;
      case '<=':
        return difference <= 0n;
      case '>=':
        return difference >= 0n;
      default:
        return difference === 0n;
    }
  }

  private product(): Fraction {
    let left = this.quotient();
    for (let op = this.take('*', '×', '÷'); op; op = this.take('*', '×', '÷')) {
      const right = this.quotient();
      left =
        op === '÷'
          ? fraction(left.n * right.d, left.d * right.n)
          : fraction(left.n * right.n, left.d * right.d);
    }
    return left;
  }

  private quotient(): Fraction {
    const left = this.factor();
    if (!this.take('/')) return left;
    const right = this.factor();
    if (this.take('/')) throw new Error('กรุณาใส่วงเล็บเมื่อเขียนการหารต่อกัน');
    return fraction(left.n * right.d, left.d * right.n);
  }

  private factor(): Fraction {
    const sign = this.take('+', '-');
    let value: Fraction;
    if (this.take('sqrt(', '√(')) {
      value = squareRoot(this.expression());
      if (!this.take(')')) throw new Error('ปิดวงเล็บไม่ครบ');
    } else if (this.take('(')) {
      value = this.expression();
      if (!this.take(')')) throw new Error('ปิดวงเล็บไม่ครบ');
    } else {
      numberPattern.lastIndex = this.position;
      const token = numberPattern.exec(this.text)?.[0];
      if (!token) throw new Error('ต้องเป็นตัวเลขหรือวงเล็บ');
      this.position += token.length;
      value = decimal(token);
    }
    if (this.take('^')) {
      const exponentPattern = /\d+/y;
      exponentPattern.lastIndex = this.position;
      const digits = exponentPattern.exec(this.text)?.[0];
      if (!digits || Number(digits) > MAX_EXPONENT)
        throw new Error(`เลขยกกำลังต้องเป็นจำนวนเต็มไม่เกิน ${MAX_EXPONENT}`);
      this.position += digits.length;
      value = power(value, Number(digits));
    }
    return sign === '-' ? { n: -value.n, d: value.d } : value;
  }
}

export function evalExpr(text: string): Fraction {
  const parser = new Parser(normalize(text));
  const value = parser.expression();
  parser.finish();
  return value;
}

export function evalStatement(text: string): boolean {
  const parser = new Parser(normalize(text));
  const value = parser.statement();
  parser.finish();
  return value;
}

export function parseNumberText(text: string): Fraction | undefined {
  const source = normalize(text).trim();
  const number =
    /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:(?:\s+(\d+))?\s*\/\s*(\d+))?(?:\s*\p{L}[\p{L}\p{M}\s.]*)?$/u;
  const match = number.exec(source);
  if (!match) return undefined;
  const whole = match[2];
  if (whole === undefined) return undefined;

  const [, sign, , mixed, denominator] = match;
  const value = decimal(whole);
  if (denominator === undefined) return fraction(sign === '-' ? -value.n : value.n, value.d);
  const d = BigInt(denominator);
  if (d === 0n || (mixed !== undefined && whole.includes('.'))) return undefined;
  const n = mixed === undefined ? value.n : value.n * d + BigInt(mixed);
  return fraction(sign === '-' ? -n : n, value.d * d);
}

type Report = (code: string, message: string) => void;

function tryStatement(text: string): boolean | undefined {
  try {
    return evalStatement(text);
  } catch {
    return undefined;
  }
}

function verifyQuestion(question: Question, report: Report): Fraction | boolean | undefined {
  const { verify } = question;
  if (!verify) return undefined;

  const expectedText = verify.expected.trim().toLowerCase();
  const statement = /[<>=]/.test(verify.expr);
  let expected: Fraction | boolean | undefined;
  if (statement) {
    if (expectedText === 'true' || expectedText === 'false') expected = expectedText === 'true';
  } else {
    expected = parseNumberText(expectedText);
  }
  if (expected === undefined) {
    report('verify_expected', 'อ่านค่าที่คาดไว้ใน verify ไม่ได้');
    return undefined;
  }

  try {
    const actual =
      typeof expected === 'boolean' ? evalStatement(verify.expr) : evalExpr(verify.expr);
    const matches =
      typeof actual === 'boolean' || typeof expected === 'boolean'
        ? actual === expected
        : compare(actual, expected) === 0n;
    if (!matches) {
      report(
        'verify_mismatch',
        `ผลคำนวณคือ ${typeof actual === 'boolean' ? actual : show(actual)} แต่ verify ระบุ ${verify.expected}`,
      );
      return undefined;
    }
    return actual;
  } catch (error) {
    report('verify_expr', error instanceof Error ? error.message : 'คำนวณนิพจน์ใน verify ไม่ได้');
    return undefined;
  }
}

function stemValue(text: string, report: Report): Fraction | undefined {
  const expression = /^(?:ค่าของ\s*)?([\d๐-๙.\s()+\-−*/×÷]+)\s*(?:มีค่า|เท่ากับ|ได้ผลลัพธ์)/.exec(
    text.trim(),
  )?.[1];
  if (!expression?.trim()) return undefined;
  try {
    return evalExpr(expression);
  } catch (error) {
    report('verify_expr', error instanceof Error ? error.message : 'คำนวณนิพจน์ในโจทย์ไม่ได้');
    return undefined;
  }
}

function checkQuestion(question: Question, report: Report): boolean {
  const { choices, correctChoiceId, text } = question;
  if (choices.length !== 4 || new Set(choices.map((choice) => choice.id)).size !== 4) {
    report('choices', 'ต้องมี 4 ตัวเลือกและรหัสตัวเลือกต้องไม่ซ้ำกัน');
  }
  const key = choices.find((choice) => choice.id === correctChoiceId);
  if (!key) report('key_missing', 'ไม่พบรหัสเฉลยในตัวเลือก');

  const labels = new Set<string>();
  const values = new Map<string, Fraction>();
  const reduced = new Set<string>();
  for (const choice of choices) {
    const label = choice.text.trim().replace(/\s+/g, ' ');
    if (labels.has(label)) report('duplicate_choice', `ข้อความตัวเลือกซ้ำกัน (${label})`);
    labels.add(label);

    const value = parseNumberText(choice.text);
    if (!value) continue;
    const exact = show(value);
    if (reduced.has(exact)) report('duplicate_value', `ตัวเลือกมีค่าเท่ากัน (${exact})`);
    reduced.add(exact);
    values.set(choice.id, value);
  }

  const verifiedValue = verifyQuestion(question, report);
  if (!key || (question.verify && verifiedValue === undefined)) return false;
  const statements = choices.map((choice) => ({ choice, value: tryStatement(choice.text) }));
  if (typeof verifiedValue === 'boolean' || statements.some(({ value }) => value !== undefined)) {
    const target = !/ไม่ถูกต้อง|ผิด/.test(text);
    const matches = statements.filter(({ value }) => value === target);
    if (matches.length !== 1) {
      report(
        'statement_count',
        `ต้องมีข้อความที่ตรงกับคำถาม 1 ตัวเลือก แต่พบ ${matches.length} ตัวเลือก`,
      );
      return false;
    }
    const answer = matches[0]?.choice;
    if (answer?.id !== key.id) {
      report('wrong_key', `คำตอบคือ ${answer?.text}`);
      return false;
    }
    return true;
  }

  const extreme =
    /(?:ข้อ|จำนวน|เศษส่วน|ทศนิยม|ตัวเลือก)(?:ใด|ไหน)(?:ต่อไปนี้)?\s*(?:มีค่า)?\s*(มากที่สุด|น้อยที่สุด)\s*[?？]?\s*$/.exec(
      text,
    )?.[1];
  let expected = stemValue(text, report) ?? verifiedValue;
  if (extreme && values.size === choices.length) {
    expected = undefined;
    for (const value of values.values()) {
      if (
        !expected ||
        (extreme === 'มากที่สุด' ? compare(value, expected) > 0n : compare(value, expected) < 0n)
      ) {
        expected = value;
      }
    }
  }
  if (!expected) return false;

  const keyValue = values.get(key.id);
  if (!keyValue) report('key_unparseable', `อ่านค่าของตัวเลือกเฉลยไม่ได้ (${key.text})`);
  const matches = [...values.values()].some((value) => compare(value, expected) === 0n);
  if (!matches) report('no_choice_matches', `ไม่มีตัวเลือกที่มีค่า ${show(expected)}`);
  if (!keyValue || !matches) return false;
  if (compare(keyValue, expected) !== 0n) {
    report('wrong_key', `คำตอบคือ ${show(expected)} แต่เฉลยระบุ ${key.text}`);
    return false;
  }
  return true;
}

export function checkAssessment(assessment: Assessment, options: CheckOptions = {}): CheckResult {
  const { expectedCount, minQuestions = 1 } = options;
  const count = assessment.questions.length;
  const errors: Finding[] = [];
  const verified: string[] = [];
  const unverified: string[] = [];

  if (expectedCount !== undefined && count !== expectedCount) {
    errors.push({
      code: 'count_mismatch',
      message: `ต้องมี ${expectedCount} ข้อ แต่พบ ${count} ข้อ`,
    });
  }
  if (count < minQuestions) {
    errors.push({ code: 'too_few', message: `ต้องมีอย่างน้อย ${minQuestions} ข้อ` });
  }

  const ids = new Set<string>();
  for (const question of assessment.questions) {
    const report: Report = (code, message) =>
      errors.push({ code, message, questionId: question.id });
    const before = errors.length;
    if (ids.has(question.id)) report('duplicate_question_id', `รหัสข้อซ้ำกัน (${question.id})`);
    ids.add(question.id);
    const proved = checkQuestion(question, report);
    (proved && errors.length === before ? verified : unverified).push(question.id);
  }
  return { ok: errors.length === 0, errors, verified, unverified };
}
