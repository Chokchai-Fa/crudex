import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-error';

export function InvitationForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (credential: string) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [code, setCode] = useState('');
  const invalid = error instanceof ApiError && [400, 401, 422].includes(error.status);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.trim() && !pending) onSubmit(code.trim());
      }}
    >
      <label className="grid gap-2">
        รหัสเชิญจากผู้ดูแลโรงเรียน
        <Input
          type="password"
          name="credential"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          readOnly={pending}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {invalid
            ? 'ใช้รหัสนี้ไม่ได้ ตรวจสอบว่าคัดลอกมาครบ หรือขอรหัสใหม่จากผู้ดูแลโรงเรียน'
            : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง'}
        </p>
      )}
      <Button disabled={pending || !code.trim()}>
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </Button>
    </form>
  );
}
