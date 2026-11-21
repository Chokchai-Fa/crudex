import { z } from 'zod';
import { ToolError } from '../tools/identity';

const fileReply = z.object({
  ok: z.literal(true),
  fileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  url: z
    .string()
    .regex(/^https:\/\/(?:docs|drive)\.google\.com\/[A-Za-z0-9_\-/?=&.#]+$/)
    .refine((url) => !url.includes('script.google.com')),
});

export type BridgeFile = z.infer<typeof fileReply>;

export async function createBridgeFile(
  action: 'createSlides' | 'createPdf',
  payload: Record<string, unknown>,
  signal: AbortSignal,
): Promise<BridgeFile> {
  const endpoint = process.env.SCHOOL_BOT_APPS_SCRIPT_URL;
  if (!endpoint)
    throw new ToolError('unavailable', 'ยังไม่ได้เชื่อมต่อ Google Drive จึงสร้างไฟล์ไม่ได้');
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
    });
    if (response.ok) {
      const result = fileReply.safeParse(await response.json());
      if (result.success) return result.data;
    }
  } catch {
    // Fetch errors and bridge replies may contain the private deployment URL.
  }
  throw new ToolError('unavailable', 'สร้างไฟล์ไม่สำเร็จ ยังไม่มีไฟล์ ห้ามแจ้งลิงก์หรือรหัสไฟล์');
}
