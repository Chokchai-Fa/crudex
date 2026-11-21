import { NotebookPen, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteNote } from '../api/use-delete-note';
import { useNotes } from '../api/use-notes';

/** Loading skeletons, an error state with retry, an empty state, then the cards. */
export function NoteList() {
  const notes = useNotes();
  const deleteNote = useDeleteNote();

  if (notes.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (notes.isError) {
    return (
      <EmptyState
        icon={RotateCw}
        title="Couldn't load notes"
        description={notes.error.message}
        action={<Button onClick={() => void notes.refetch()}>Try again</Button>}
      />
    );
  }

  if (notes.data.items.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No notes yet"
        description="Write your first note above — it shows up here right away."
      />
    );
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {notes.data.items.map((note) => (
        <li key={note.id}>
          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="min-w-0 break-words">{note.title}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={`Delete “${note.title}”`}
                disabled={deleteNote.isPending && deleteNote.variables === note.id}
                onClick={() =>
                  deleteNote.mutate(note.id, {
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                <Trash2 />
              </Button>
            </CardHeader>
            {note.body && (
              <CardContent className="text-muted-foreground text-sm break-words whitespace-pre-line">
                {note.body}
              </CardContent>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
