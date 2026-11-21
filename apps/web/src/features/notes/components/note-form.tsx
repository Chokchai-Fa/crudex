import { zodResolver } from '@hookform/resolvers/zod';
import { createNoteSchema, type CreateNoteInput } from '@repo/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateNote } from '../api/use-create-note';

const EMPTY: CreateNoteInput = { title: '', body: '' };

/** One primary action. On failure the draft stays, so nothing typed is lost. */
export function NoteForm() {
  const createNote = useCreateNote();
  const form = useForm<CreateNoteInput>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });
  const rootError = form.formState.errors.root?.message;

  async function onSubmit(values: CreateNoteInput) {
    form.clearErrors('root');
    try {
      await createNote.mutateAsync(values);
      form.reset(EMPTY);
      toast.success('Note saved');
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : "Couldn't save this note. Try again.",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="What's on your mind?" enterKeyHint="next" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Add details" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {rootError && (
          <p role="alert" className="text-destructive text-sm">
            {rootError}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full md:w-auto md:self-end"
          disabled={createNote.isPending}
        >
          {createNote.isPending ? 'Saving…' : 'Save note'}
        </Button>
      </form>
    </Form>
  );
}
