import { Button } from '@/components/ui/button';

export function LoadError({
  message,
  retry,
  busy,
}: {
  message: string;
  retry: () => void;
  busy: boolean;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p>{message}</p>
      <Button variant="outline" size="sm" disabled={busy} onClick={retry}>
        {busy ? 'กำลังโหลด…' : 'ลองอีกครั้ง'}
      </Button>
    </div>
  );
}
