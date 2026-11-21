import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, NotebookPen } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/notes')({ component: NotesDemo });

function NotesDemo() {
  const [notes, setNotes] = useState<{ id: string; text: string }[]>([]);
  const [draft, setDraft] = useState('');
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Button asChild variant="link" className="px-0">
        <Link to="/teacher">
          <ArrowLeft aria-hidden="true" />
          กลับหน้าครู
        </Link>
      </Button>
      <PageHeader
        title="บันทึกทดลอง"
        actions={<ThemeToggle />}
        description="ทดลองเพิ่มและลบในหน้านี้ ข้อมูลจะล้างเมื่อออกจากหน้า"
      />
      <form
        className="space-y-4 rounded-3xl border bg-card p-5 shadow-sm sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          setNotes([...notes, { id: crypto.randomUUID(), text: draft.trim() }]);
          setDraft('');
        }}
      >
        <Label htmlFor="note" className="gap-2 text-base font-semibold">
          <NotebookPen aria-hidden="true" className="size-5 text-primary" /> เขียนบันทึก
        </Label>
        <Input id="note" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button disabled={!draft.trim()}>เพิ่มบันทึก</Button>
      </form>
      {notes.length > 0 && <h2 className="font-semibold">บันทึกในหน้านี้ ({notes.length})</h2>}
      <ul className="space-y-2">
        {notes.map((note) => (
          <li
            key={note.id}
            className="flex items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-2"
          >
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
