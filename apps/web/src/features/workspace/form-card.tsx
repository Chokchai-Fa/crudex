import { useEffect, useRef, useState } from 'react';
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
    <article className="min-w-0 space-y-3 rounded-2xl border p-4">
      <h2 className="font-semibold">ฟอร์มจำลอง · {room}</h2>
      <p className="text-sm">บวกและลบเศษส่วน · 10 ข้อ</p>
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
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a ref={formLink} href={url} target="_blank" rel="noreferrer">
                เปิดฟอร์ม
              </a>
            </Button>
            <Button variant="outline" onClick={copyLink}>
              คัดลอกลิงก์
            </Button>
          </div>
          <p role="status" className="text-sm">
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
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3">ทดสอบสถานะเดโม</summary>
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
        </>
      )}
    </article>
  );
}
