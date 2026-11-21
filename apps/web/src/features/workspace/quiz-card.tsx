import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { answerChoices, exercises } from './fraction-set';

const choiceColors = [
  'bg-blue-100 text-blue-950 dark:bg-blue-900 dark:text-blue-50',
  'bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50',
  'bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50',
  'bg-rose-100 text-rose-950 dark:bg-rose-900 dark:text-rose-50',
];

export function QuizCard({
  room,
  step,
  setStep,
}: {
  room: string;
  step: number;
  setStep: (step: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState('');
  const question = exercises[step];
  function move(next: number) {
    setSelected('');
    setRevealed(false);
    setStep(next);
  }
  return (
    <article className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <h2 className="font-semibold">ควิซสด · {room}</h2>
      <p className="text-sm">ครูเปิดโจทย์ทีละข้อบนหน้าจอนี้</p>
      {question ? (
        <>
          <p role="status">
            ข้อ {step + 1}/{exercises.length} · {question[0]} = ?
          </p>
          <div role="group" aria-label="เลือกคำตอบควิซ" className="grid grid-cols-2 gap-2">
            {answerChoices(question[1], step, 4).map((value, index) => (
              <button
                key={value}
                aria-pressed={selected === value}
                className={
                  'min-h-11 rounded-xl font-semibold focus-visible:outline-2 aria-pressed:ring-2 aria-pressed:ring-primary ' +
                  choiceColors[index]
                }
                onClick={() => setSelected(value)}
              >
                {value}
              </button>
            ))}
          </div>
          {selected && (
            <p role="status">{selected === question[1] ? 'ตอบถูกแล้ว' : 'ลองเลือกคำตอบอีกครั้ง'}</p>
          )}
          {revealed && <p>คำตอบ · {question[1]}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setRevealed(!revealed)}>
              {revealed ? 'ซ่อนเฉลย' : 'เฉลยข้อนี้'}
            </Button>
            <Button onClick={() => move(step + 1)}>
              {step === exercises.length - 1 ? 'จบควิซ' : 'ข้อถัดไป'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {step === exercises.length && <p role="status">จบควิซครบ {exercises.length} ข้อแล้ว</p>}
          <Button variant="outline" onClick={() => move(0)}>
            {step < 0 ? 'เริ่มควิซ' : 'เริ่มควิซอีกครั้ง'}
          </Button>
        </>
      )}
    </article>
  );
}
