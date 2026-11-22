import { z } from 'zod';
import { STORY_RULES, VOICE_STYLE } from './rules';

async function post(path: string, body: object) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI credentials unavailable');
  try {
    const response = await fetch(`https://api.openai.com/v1${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.ok) return response;
  } catch {
    // Provider and transport errors can contain request details.
  }
  throw new Error('OpenAI request failed');
}

export async function writeStory(
  topic: string,
  grade: string,
  shots: number,
  problemsFromLastTry?: string[],
): Promise<unknown> {
  const response = await post('/chat/completions', {
    model: 'gpt-5.4-mini',
    reasoning_effort: 'low',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: STORY_RULES },
      { role: 'user', content: JSON.stringify({ topic, grade, shots, problemsFromLastTry }) },
    ],
  });
  try {
    const result = z
      .object({
        choices: z.array(z.object({ message: z.object({ content: z.string() }) })),
      })
      .parse(await response.json());
    return JSON.parse(result.choices[0]?.message.content ?? 'null') as unknown;
  } catch {
    return null;
  }
}

export interface ImageOptions {
  size?: '1024x1024' | '1536x1024';
  transparent?: boolean;
}

export async function makeImage(prompt: string, opts: ImageOptions = {}): Promise<Uint8Array> {
  const response = await post('/images/generations', {
    model: 'gpt-image-1.5',
    prompt,
    size: opts.size ?? '1536x1024',
    quality: 'medium',
    n: 1,
    background: opts.transparent ? 'transparent' : 'opaque',
    output_format: opts.transparent ? 'png' : 'jpeg',
  });
  const result = z
    .object({ data: z.array(z.object({ b64_json: z.string().min(1) })) })
    .safeParse(await response.json());
  const encoded = result.success && result.data.data[0]?.b64_json;
  if (!encoded) throw new Error('OpenAI image unavailable');
  return Buffer.from(encoded, 'base64');
}

export async function makeVoice(text: string): Promise<Uint8Array> {
  const response = await post('/audio/speech', {
    model: 'gpt-4o-mini-tts',
    voice: 'coral',
    input: text,
    instructions: VOICE_STYLE,
    response_format: 'mp3',
  });
  return new Uint8Array(await response.arrayBuffer());
}
