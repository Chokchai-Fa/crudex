import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { exercises, answerChoices } from './fraction-set';
import { Button } from '@/components/ui/button';

type FormCardProps = {
  room: string;
  failed: boolean;
  onFailureChange: (failed: boolean) => void;
};

export function FormCard({ room, failed, onFailureChange }: FormCardProps) {
  const [message, setMessage] = useState('');
  const retryButton = useRef<HTMLButtonElement>(null);
  const formLink = useRef<HTMLAnchorElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (restoreFocus.current) {
      (failed ? retryButton.current : formLink.current)?.focus();
      restoreFocus.current = false;
    }
  }, [failed]);

  const url = new URL(
    '/student/' + room.replace('ป.', '').replace('/', '-'),
    window.location.origin,
  ).href;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('คัดลอกลิงก์แล้ว');
    } catch {
      setMessage('เลือกข้อความลิงก์ด้านล่างเพื่อคัดลอก');
    }
  }

  return (
    <article className="output-card form-output">
      <div className="mini-page form-page" aria-hidden="true">
        <b>แบบทดสอบ เศษส่วน</b>
        <span>ข้อ 1: {exercises[0][0]} = ?</span>
        <small>○ {answerChoices(exercises[0][1], 0, 4).slice(0, 2).join('　○ ')}</small>
      </div>
      <div className="form-title">
        <h2>ฟอร์ม</h2>
        {!failed && (
          <details className="form-options">
            <summary aria-label="ทดสอบสถานะฟอร์ม" title="ทดสอบสถานะฟอร์ม">
              ⋯
            </summary>
            <Button
              variant="outline"
              onClick={() => {
                restoreFocus.current = true;
                onFailureChange(true);
                setMessage('');
              }}
            >
              จำลองฟอร์มล้มเหลว
            </Button>
          </details>
        )}
      </div>
      {failed ? (
        <>
          <p role="status">จำลองการเตรียมฟอร์มไม่สำเร็จ</p>
          <Button
            ref={retryButton}
            variant="outline"
            onClick={() => {
              restoreFocus.current = true;
              onFailureChange(false);
              setMessage('ฟอร์มจำลองพร้อมแล้ว');
            }}
          >
            ลองเตรียมฟอร์มอีกครั้ง
          </Button>
        </>
      ) : (
        <>
          <div className="card-actions">
            <Button asChild variant="outline">
              <a ref={formLink} href={url} target="_blank" rel="noreferrer">
                เปิดฟอร์ม
              </a>
            </Button>
            <Button
              variant="outline"
              title="คัดลอกลิงก์"
              aria-label="คัดลอกลิงก์"
              onClick={copyLink}
            >
              <Copy aria-hidden="true" size={15} />
              <span className="sr-only xl:not-sr-only">คัดลอกลิงก์</span>
            </Button>
          </div>
          <p role="status" className="text-sm empty:hidden">
            {message}
          </p>
          {message.startsWith('เลือก') && (
            <input
              aria-label="ลิงก์ฟอร์มจำลอง"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
              className="w-full rounded border p-2"
            />
          )}
        </>
      )}
    </article>
  );
}
