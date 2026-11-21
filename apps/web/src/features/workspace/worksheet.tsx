import { Button } from '@/components/ui/button';
import './worksheet.css';

const exercises = [
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
];

export function Worksheet({ room }: { room: string }) {
  return (
    <article className="worksheet space-y-4 rounded-lg border p-5">
      <header>
        <p className="text-sm">คณิตศาสตร์ · {room} · ชุดตัวอย่าง ป.5</p>
        <h2 className="text-xl font-semibold">ใบงานบวกและลบเศษส่วน</h2>
      </header>
      <p>ชื่อ ______________________ เลขที่ ______</p>
      <p>แสดงวิธีทำและตอบเป็นเศษส่วนอย่างต่ำ</p>
      <ol className="grid list-decimal gap-x-10 gap-y-4 ps-6 sm:grid-cols-2">
        {exercises.map(([question]) => (
          <li key={question} className="min-h-20 border-b">
            {question} =
          </li>
        ))}
      </ol>
      <details className="print:hidden">
        <summary className="cursor-pointer py-2">ดูเฉลยสำหรับครู</summary>
        <ol className="list-decimal ps-6">
          {exercises.map(([question, answer]) => (
            <li key={question}>{answer}</li>
          ))}
        </ol>
      </details>
      <Button className="print:hidden" onClick={() => window.print()}>
        พิมพ์ใบงาน A4
      </Button>
    </article>
  );
}
