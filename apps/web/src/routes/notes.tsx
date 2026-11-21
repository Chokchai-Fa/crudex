import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/notes')({ component: NotesDemo });

function NotesDemo() {
  const [notes, setNotes] = useState<{ id: string; text: string }[]>([]);
  const [draft, setDraft] = useState('');
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="บันทึกตัวอย่าง"
        description="ทดลองเพิ่มและลบในหน้านี้ ข้อมูลจะล้างเมื่อออกจากหน้า"
      />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          setNotes([...notes, { id: crypto.randomUUID(), text: draft.trim() }]);
          setDraft('');
        }}
      >
        <Label htmlFor="note">ข้อความ</Label>
        <Input id="note" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button disabled={!draft.trim()}>เพิ่มบันทึก</Button>
      </form>
      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="flex items-center justify-between gap-4">
            <span className="min-w-0 break-words">{note.text}</span>
            <Button
              variant="outline"
              aria-label={'ลบบันทึก ' + note.text}
              onClick={() => setNotes(notes.filter((item) => item.id !== note.id))}
            >
              ลบ
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
