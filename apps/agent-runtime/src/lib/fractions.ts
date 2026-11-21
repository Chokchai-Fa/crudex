export interface Frac {
  readonly n: bigint;
  readonly d: bigint;
}

const gcd = (a: bigint, b: bigint): bigint => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

export function frac(n: bigint, d: bigint = 1n): Frac {
  if (d === 0n) throw new Error('หารด้วยศูนย์');
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d) || 1n;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
export const equal = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;
const cmp = (a: Frac, b: Frac) => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};
export const show = (f: Frac) => (f.d === 1n ? String(f.n) : `${f.n}/${f.d}`);

type Token =
  | { t: 'num'; v: Frac; lit: boolean }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '÷' }
  | { t: 'cmp'; v: '<' | '>' | '=' | '<=' | '>=' }
  | { t: '(' | ')' };

function tokenize(src: string): Token[] {
  const s = src
    .replace(/[−–—]/g, '-')
    .replace(/[×x✕]/g, '*')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i] as string;
    if (/\s/.test(c)) {
      i++;
    } else if (/\d/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j] as string)) j++;
      const text = s.slice(i, j);
      const dec = /^(\d+)(?:\.(\d+))?$/.exec(text);
      if (!dec) throw new Error(`ตัวเลขไม่ถูกต้อง: ${text}`);
      const frac1 = dec[2] ?? '';
      const value = frac(BigInt(dec[1] + frac1), 10n ** BigInt(frac1.length));
      const isInt = frac1 === '';
      const slashNext = s[j] === '/' && /\d/.test(s[j + 1] ?? '') && isInt;
      if (slashNext) {
        let k = j + 1;
        while (k < s.length && /\d/.test(s[k] as string)) k++;
        out.push({ t: 'num', v: frac(BigInt(text), BigInt(s.slice(j + 1, k))), lit: true });
        i = k;
      } else {
        out.push({ t: 'num', v: value, lit: false });
        i = j;
      }
    } else if ('+-*/÷'.includes(c)) {
      out.push({ t: 'op', v: c as '+' | '-' | '*' | '/' | '÷' });
      i++;
    } else if (c === '(' || c === ')') {
      out.push({ t: c });
      i++;
    } else if (c === '<' || c === '>' || c === '=') {
      const two = s.slice(i, i + 2);
      if (two === '<=' || two === '>=') {
        out.push({ t: 'cmp', v: two });
        i += 2;
      } else {
        out.push({ t: 'cmp', v: c });
        i++;
      }
    } else {
      throw new Error(`อักขระที่ไม่รองรับ: ${c}`);
    }
  }
  return out;
}

class Parser {
  private pos = 0;
  constructor(private readonly toks: Token[]) {}

  parseValue(): Frac {
    const v = this.expr();
    if (this.pos !== this.toks.length) throw new Error('นิพจน์ไม่สมบูรณ์');
    return v;
  }

  parseCompare(): boolean | Frac {
    const left = this.expr();
    const tok = this.toks[this.pos];
    if (!tok || tok.t !== 'cmp') {
      if (this.pos !== this.toks.length) throw new Error('นิพจน์ไม่สมบูรณ์');
      return left;
    }
    this.pos++;
    const right = this.expr();
    if (this.pos !== this.toks.length) throw new Error('นิพจน์ไม่สมบูรณ์');
    const c = cmp(left, right);
    return { '<': c < 0, '>': c > 0, '=': c === 0, '<=': c <= 0, '>=': c >= 0 }[tok.v];
  }

  private expr(): Frac {
    let acc = this.term();
    for (;;) {
      const tok = this.toks[this.pos];
      if (tok?.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        this.pos++;
        const rhs = this.term();
        acc = tok.v === '+' ? add(acc, rhs) : sub(acc, rhs);
      } else return acc;
    }
  }

  private term(): Frac {
    let acc = this.factor();
    for (;;) {
      const tok = this.toks[this.pos];
      if (tok?.t === 'op' && (tok.v === '*' || tok.v === '/' || tok.v === '÷')) {
        this.pos++;
        const rhs = this.factor();
        acc = tok.v === '*' ? mul(acc, rhs) : div(acc, rhs);
      } else return acc;
    }
  }

  private factor(): Frac {
    const tok = this.toks[this.pos];
    if (!tok) throw new Error('นิพจน์ไม่สมบูรณ์');
    if (tok.t === 'op' && tok.v === '-') {
      this.pos++;
      const v = this.factor();
      return frac(-v.n, v.d);
    }
    if (tok.t === 'num') {
      this.pos++;
      const next = this.toks[this.pos];
      if (next?.t === 'op' && next.v === '/' && (tok.lit || this.toks[this.pos + 1]?.t === 'num')) {
        throw new Error('ตัวหารต่อกันกำกวม ใส่วงเล็บ เช่น (4/7)/(2/7)');
      }
      return tok.v;
    }
    if (tok.t === '(') {
      this.pos++;
      const v = this.expr();
      if (this.toks[this.pos]?.t !== ')') throw new Error('วงเล็บไม่ครบ');
      this.pos++;
      return v;
    }
    throw new Error('นิพจน์ไม่ถูกต้อง');
  }
}

export function evalExpr(src: string): Frac {
  return new Parser(tokenize(src)).parseValue();
}

export function evalStatement(src: string): boolean | Frac {
  return new Parser(tokenize(src)).parseCompare();
}

export function parseNumberText(text: string): Frac | undefined {
  const s = text.replace(/[−–—]/g, '-').trim();
  const mixed = /^(-?\d+)\s+(\d+)\/(\d+)(?!\d)/.exec(s);
  if (mixed) {
    const whole = BigInt(mixed[1] as string);
    const part = frac(BigInt(mixed[2] as string), BigInt(mixed[3] as string));
    return whole < 0n ? sub(frac(whole), part) : add(frac(whole), part);
  }
  const simple = /^(-?\d+)\/(\d+)(?![\d/])/.exec(s);
  if (simple) return frac(BigInt(simple[1] as string), BigInt(simple[2] as string));
  const dec = /^(-?\d+)(?:\.(\d+))?(?![\d/])/.exec(s);
  if (dec) {
    const f = dec[2] ?? '';
    return frac(BigInt((dec[1] as string) + f), 10n ** BigInt(f.length));
  }
  return undefined;
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
  questionId: string | null;
  code: string;
  message: string;
}
export interface CheckResult {
  ok: boolean;
  errors: Finding[];
  unverified: string[];
  verified: string[];
}

const STEM_EXPR = /[\d(][\d\s./+\-−×÷*x()<>=≤≥]*[\d)]/g;

function tryEval<T>(f: () => T): { ok: true; v: T } | { ok: false; error: string } {
  try {
    return { ok: true, v: f() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function stemExpressions(stem: string): string[] {
  return (stem.match(STEM_EXPR) ?? [])
    .map((m) => m.trim())
    .filter((m) => /\d\s*[+\-−×÷*x<>=≤≥]\s*[\d(]|\d\s*[+\-−×÷*x<>=≤≥]\s*-?\d|\)\s*[+\-−×÷*/]/.test(m));
}

export interface CheckOptions {
  /** Exact number the teacher asked for; a different count is an error. */
  expectedCount?: number;
  minQuestions?: number;
}

export function checkAssessment(a: Assessment, opts: CheckOptions = {}): CheckResult {
  const errors: Finding[] = [];
  const verified: string[] = [];
  const unverified: string[] = [];
  const err = (questionId: string | null, code: string, message: string) => errors.push({ questionId, code, message });
  const min = opts.minQuestions ?? 1;
  if (opts.expectedCount !== undefined && a.questions.length !== opts.expectedCount) {
    err(null, 'count_mismatch', `ครูขอ ${opts.expectedCount} ข้อ แต่มี ${a.questions.length} ข้อ`);
  }
  if (a.questions.length < min) err(null, 'too_few', `มี ${a.questions.length} ข้อ ต้องมีอย่างน้อย ${min} ข้อ`);
  const qids = new Set<string>();

  for (const q of a.questions) {
    if (qids.has(q.id)) err(q.id, 'duplicate_question_id', `รหัสข้อซ้ำ ${q.id}`);
    qids.add(q.id);
    const ids = new Set(q.choices.map((c) => c.id));
    if (q.choices.length !== 4 || ids.size !== 4) err(q.id, 'choices', 'ต้องมีตัวเลือก 4 ข้อ รหัสไม่ซ้ำ');
    const key = q.choices.find((c) => c.id === q.correctChoiceId);
    if (!key) {
      err(q.id, 'key_missing', `เฉลย ${q.correctChoiceId} ไม่อยู่ในตัวเลือก`);
      continue;
    }

    const textSeen = new Map<string, string>();
    for (const c of q.choices) {
      const norm = c.text.normalize('NFC').replace(/\s+/g, '').toLowerCase();
      const prev = textSeen.get(norm);
      if (prev) err(q.id, 'duplicate_choice', `ตัวเลือก ${prev} กับ ${c.id} ข้อความซ้ำกัน`);
      textSeen.set(norm, c.id);
    }

    const values = q.choices.map((c) => ({ id: c.id, v: parseNumberText(c.text) }));
    const numeric = values.every((x) => x.v !== undefined);
    if (numeric) {
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a1 = values[i]?.v;
          const b1 = values[j]?.v;
          if (a1 && b1 && equal(a1, b1)) {
            err(q.id, 'duplicate_value', `ตัวเลือก ${values[i]?.id} กับ ${values[j]?.id} มีค่าเท่ากัน (${show(a1)})`);
          }
        }
      }
    }
    const keyValue = parseNumberText(key.text);
    let proven = false;

    if (q.verify) {
      const expr = tryEval(() => evalExpr(q.verify?.expr ?? ''));
      const stmt = expr.ok ? undefined : tryEval(() => evalStatement(q.verify?.expr ?? ''));
      if (expr.ok) {
        const expected = parseNumberText(q.verify.expected);
        if (!expected) err(q.id, 'verify_expected', `verify.expected อ่านค่าไม่ได้: ${q.verify.expected}`);
        else if (!equal(expr.v, expected)) err(q.id, 'verify_mismatch', `verify.expr = ${show(expr.v)} แต่ expected = ${show(expected)}`);
        else if (keyValue && !equal(keyValue, expr.v)) err(q.id, 'wrong_key', `คำนวณได้ ${show(expr.v)} แต่เฉลย ${key.id} = ${show(keyValue)}`);
        else if (!keyValue) err(q.id, 'key_unparseable', `เฉลย ${key.id} อ่านเป็นตัวเลขไม่ได้ ตรวจกับ verify ไม่ได้`);
        else proven = true;
      } else if (stmt?.ok && typeof stmt.v === 'boolean') {
        const exp = q.verify.expected.trim().toLowerCase();
        if (String(stmt.v) !== exp) err(q.id, 'verify_mismatch', `verify.expr เป็น ${stmt.v} แต่ expected = ${exp}`);
        else proven = true;
      } else {
        err(q.id, 'verify_invalid', `verify.expr ใช้ไม่ได้: ${expr.ok ? '' : expr.error}`);
      }
    }

    const stmtChoices = q.choices.map((c) => ({ id: c.id, r: tryEval(() => evalStatement(c.text)) }));
    const statements = stmtChoices.filter((x) => x.r.ok && typeof x.r.v === 'boolean');
    if (statements.length >= 2) {
      const trues = statements.filter((x) => x.r.ok && x.r.v === true).map((x) => x.id);
      if (trues.length > 1) err(q.id, 'statement_count', `ตัวเลือกที่เป็นจริงมี ${trues.length} ข้อ (${trues.join(', ')}) ต้องมีข้อเดียว`);
      else if (trues.length === 1 && trues[0] !== key.id) err(q.id, 'wrong_key', `ตัวเลือกที่ถูกคือ ${trues[0]} แต่เฉลยคือ ${key.id}`);
      else if (trues.length === 1) proven = true;
    } else if (numeric && /มากที่สุด|น้อยที่สุด/.test(q.text)) {
      const sorted = [...values].sort((x, y) => cmp(x.v as Frac, y.v as Frac));
      const target = /มากที่สุด/.test(q.text) ? sorted[sorted.length - 1] : sorted[0];
      if (target && target.id !== key.id) err(q.id, 'wrong_key', `ค่า${/มากที่สุด/.test(q.text) ? 'มาก' : 'น้อย'}ที่สุดคือ ${target.id} แต่เฉลยคือ ${key.id}`);
      else proven = true;
    }

    if (!q.verify) {
      for (const src of stemExpressions(q.text)) {
        const r = tryEval(() => evalExpr(src));
        if (!r.ok) continue;
        if (!keyValue) continue;
        const hit = values.find((x) => x.v && equal(x.v, r.v));
        if (!hit) err(q.id, 'no_choice_matches', `โจทย์ "${src}" = ${show(r.v)} ไม่มีตัวเลือกใดมีค่านี้`);
        else if (hit.id !== key.id) err(q.id, 'wrong_key', `โจทย์ "${src}" = ${show(r.v)} ตรงกับ ${hit.id} แต่เฉลยคือ ${key.id}`);
        else proven = true;
        break;
      }
    }

    (proven ? verified : unverified).push(q.id);
  }

  return { ok: errors.length === 0, errors, unverified, verified };
}
