import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { NoteForm } from '@/features/notes/components/note-form';
import { NoteList } from '@/features/notes/components/note-list';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// Route files stay thin: compose feature components, no data fetching or logic here.
function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notes" description="An example feature — replace it with your own." />
      <Card>
        <CardContent>
          <NoteForm />
        </CardContent>
      </Card>
      <NoteList />
    </div>
  );
}
