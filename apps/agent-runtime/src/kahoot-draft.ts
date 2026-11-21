import { isDeepStrictEqual } from 'node:util';
import { assessmentSchema, runCheck } from './tools/check_assessment';

export const kahootTool = 'crudex_kahoot_create_or_update_kahoot';

function prepareDraft(input: unknown) {
  const { assessment, result } = runCheck(assessmentSchema.parse(input));
  if (!result.ok || result.unverifiedCount || !result.count) return;
  const questions = assessment.questions.map((question, index) => ({
    type: 'quiz',
    question: question.text,
    image_query: `classroom mathematics question ${index + 1}`,
    time: 30000,
    choices: question.choices.map((choice) => ({
      answer: choice.text,
      correct: choice.id === question.correctChoiceId,
    })),
  }));
  if (questions.some((q) => q.question.length > 120 || q.choices.some((c) => c.answer.length > 75)))
    return;
  return {
    title: assessment.title,
    language: 'ภาษาไทย',
    cover_image_query: 'classroom mathematics',
    questions,
  };
}

// A successful check authorizes one immutable draft in that same OpenCode session.
export class KahootDrafts {
  private readonly sessions = new Map<
    string,
    { payload: NonNullable<ReturnType<typeof prepareDraft>>; expiresAt: number }
  >();

  check(session: string, input: unknown, passed: boolean) {
    this.sessions.delete(session);
    const payload = passed ? prepareDraft(input) : undefined;
    if (payload) {
      if (this.sessions.size >= 128) this.sessions.delete(this.sessions.keys().next().value!);
      this.sessions.set(session, { payload, expiresAt: Date.now() + 15 * 60_000 });
    }
    return payload;
  }

  consume(session: string, input: unknown) {
    const draft = this.sessions.get(session);
    if (!draft || draft.expiresAt < Date.now() || !isDeepStrictEqual(input, draft.payload))
      return false;
    this.sessions.delete(session);
    return true;
  }
}
