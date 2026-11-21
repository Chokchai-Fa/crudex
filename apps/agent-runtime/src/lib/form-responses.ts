import { z } from 'zod';

const responseSchema = z.object({
  ok: z.literal(true),
  formId: z.string(),
  title: z.string(),
  questions: z.array(z.string()),
  responses: z.array(z.unknown()),
});
const rowSchema = (questionCount: number) =>
  z.object({
    studentId: z
      .string()
      .trim()
      .max(24)
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
      .regex(/\d/),
    submittedAt: z.iso.datetime({ offset: true }).pipe(z.coerce.date()),
    result: z
      .string()
      .length(questionCount)
      .regex(/^[1x]+$/),
  });

type ResponseRequest = {
  endpoint: string;
  formId: string;
  questionCount: number;
  signal: AbortSignal;
};

async function fetchResponses({ endpoint, formId, questionCount, signal }: ResponseRequest) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'getResponses', formId }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) return;
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.formId !== formId || parsed.data.title.includes(endpoint))
      return;
    const { title, responses } = parsed.data;
    const schema = rowSchema(questionCount);
    const rows = responses.flatMap((response) => {
      const parsed = schema.safeParse(response);
      return parsed.success ? [parsed.data] : [];
    });
    return { title, rows };
  } catch {
    return;
  }
}

const cache = new Map<string, { expiresAt: number; result: ReturnType<typeof fetchResponses> }>();

export function getFormResponses(request: ResponseRequest) {
  const { formId, signal } = request;
  if (signal.aborted) return;
  const now = Date.now();
  const cached = cache.get(formId);
  if (cached && cached.expiresAt > now) return cached.result;
  for (const [id, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(id);
  }
  const entry = { expiresAt: Infinity, result: fetchResponses(request) };
  cache.set(formId, entry);
  return entry.result.then((result) => {
    entry.expiresAt = Date.now() + 60_000;
    return result;
  });
}
