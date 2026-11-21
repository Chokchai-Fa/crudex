import { classroomResults } from './demo-gradebook';
import { exercises } from './fraction-set';

type ReplyKind = 'worksheet' | 'exercise' | 'scores' | 'report' | 'help';
export interface DemoTurn {
  prompt: string;
  answer: string;
  kind: ReplyKind;
  question?: number;
}

const kinds: ReplyKind[] = ['worksheet', 'exercise', 'scores', 'report', 'help'];
export const chatKey = (room: string) => 'crudex.demo.chat.' + room;

export function readConversation(room: string): DemoTurn[] {
  try {
    const turns: unknown = JSON.parse(sessionStorage.getItem(chatKey(room)) ?? '[]');
    return Array.isArray(turns)
      ? turns.filter(
          (turn) =>
            turn &&
            typeof turn.prompt === 'string' &&
            typeof turn.answer === 'string' &&
            kinds.includes(turn.kind),
        )
      : [];
  } catch {
    return [];
  }
}

export function replyTo(
  prompt: string,
  room: string,
  history: DemoTurn[],
  hasWorksheet: boolean,
): DemoTurn {
  const reply = (kind: ReplyKind, answer: string, question?: number): DemoTurn => ({
    prompt,
    kind,
    answer,
    question,
  });
  const last = history.at(-1);
  const lastQuestion = history
    .slice()
    .reverse()
    .find((turn) => turn.question)?.question;
  const digitText = prompt.replace(/[๐-๙]/g, (char) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(char)));
  const explicit = /ข้อ\s*(\d+)/.exec(digitText);
  if (
    hasWorksheet &&
    (explicit ||
      /อธิบาย|เฉลย|วิธีคิด|ข้อถัดไป|ข้อต่อไป|ข้อนี้|ง่ายขึ้น|ง่ายลง|ยากไป|ขยายความ/.test(prompt))
  ) {
    const question = explicit
      ? Number(explicit[1])
      : /ข้อถัดไป|ข้อต่อไป/.test(prompt)
        ? (lastQuestion ?? 0) + 1
        : (lastQuestion ?? 1);
    const exercise = exercises[question - 1];
    if (!exercise)
      return reply('help', 'ใบงานชุดนี้มีข้อ 1–10 ค่ะครู เลือกเลขข้อที่อยากทบทวนได้เลย');
    const [expression, answer] = exercise;
    const [left, operator, right] = expression.split(' ') as [string, string, string];
    const [leftTop, leftBottom] = left.split('/').map(Number) as [number, number];
    const [rightTop, rightBottom] = right.split('/').map(Number) as [number, number];
    const denominator = leftBottom * rightBottom;
    const equivalent = `${leftTop * rightBottom}/${denominator} ${operator} ${rightTop * leftBottom}/${denominator}`;
    return reply(
      'exercise',
      `ข้อ ${question} ของใบงานห้อง ${room} คือ ${expression} เริ่มจากทำตัวส่วนให้เท่ากัน จะได้ ${equivalent} คำตอบอย่างต่ำคือ ${answer} ค่ะ`,
      question,
    );
  }
  if (/ผู้ปกครอง|รายงาน|อีเมล/.test(prompt))
    return reply(
      'report',
      'เปิดร่างรายงานของห้อง ' + room + ' เพื่อเลือกครอบครัวและตรวจผู้รับก่อนยืนยันการส่งจำลองค่ะ',
    );
  if (
    /คะแนน|ต้องติว|ส่งแล้ว|ส่งงาน|ใครต้อง|สมุดคะแนน/.test(prompt) ||
    (last?.kind === 'scores' && /คนไหน|กี่คน|ขอรายชื่อ/.test(prompt))
  ) {
    const students = classroomResults(room);
    const submitted = students.filter((s) => s.score !== null);
    const support = submitted.filter((s) => s.score !== null && s.score < 5);
    return reply(
      'scores',
      students.length
        ? 'สมุดคะแนนตัวอย่างห้อง ' +
            room +
            ' มีผู้ส่ง ' +
            submitted.length +
            ' จาก ' +
            students.length +
            ' คน' +
            (support.length
              ? ' ผู้ที่ต้องติวคือ ' + support.map((s) => s.name).join(', ')
              : ' ทุกคนที่ส่งได้อย่างน้อยครึ่งหนึ่ง')
        : 'ห้อง ' + room + ' ยังไม่มีคะแนนตัวอย่างค่ะ',
    );
  }
  if (
    /ใบงาน|เศษส่วน|ฟอร์ม|แบบฝึก|แบบทดสอบ|ควิซ|เกม|quiz|kahoot|worksheet|form/i.test(prompt) ||
    (hasWorksheet && /เปิดชุดเดิม|ขอดูอีกครั้ง/.test(prompt))
  ) {
    return reply(
      'worksheet',
      'ใบงานบวกและลบเศษส่วน ป.5 ของห้อง ' +
        room +
        ' มี 10 ข้อค่ะ ตรวจใบงาน เปิดฟอร์ม หรือเริ่มควิซจำลองจากโจทย์ชุดนี้ได้ด้านล่าง',
    );
  }
  return reply(
    'help',
    hasWorksheet
      ? 'สำหรับใบงานเศษส่วนของห้อง ' +
          room +
          ' ลองพิมพ์ “อธิบายข้อ 3” “ใครต้องติว” หรือ “เปิดรายงานผู้ปกครอง” ได้ค่ะ'
      : 'เดโมนี้ช่วยเตรียมใบงานเศษส่วน ป.5 ดูคะแนน และเปิดร่างรายงานได้ค่ะ ครูอยากเริ่มจากงานไหนคะ',
  );
}
