import { ToolError } from './identity';

export interface MemoryItem {
  id: string;
  text: string;
  updatedAt: number;
}

const MAX_TEXT = 300;
const SENSITIVE: { code: string; test: RegExp; message: string }[] = [
  {
    code: 'national_id',
    test: /(?<!\d)\d[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d(?!\d)/,
    message: 'ห้ามบันทึกเลขบัตรประชาชน',
  },
  {
    code: 'phone',
    test: /(?<!\d)0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}(?!\d)/,
    message: 'ห้ามบันทึกเบอร์โทร',
  },
  { code: 'email', test: /[\w.+-]+@[\w-]+\.[\w.-]+/, message: 'ห้ามบันทึกอีเมล' },
  {
    code: 'secret',
    test: /\b(sk-[A-Za-z0-9_-]{16,}|[A-Fa-f0-9]{32,})\b|รหัสผ่าน|password/i,
    message: 'ห้ามบันทึกรหัสผ่านหรือคีย์',
  },
  {
    code: 'score',
    test: /คะแนน[^\n]{0,24}\d|\d[^\n]{0,12}คะแนน|\d+\s*\/\s*\d+\s*(คะแนน|ข้อ)/,
    message: 'ห้ามบันทึกคะแนน ให้ใช้ get_scores',
  },
  {
    code: 'report',
    test: /รายงาน(ผล|ผู้ปกครอง)|ผลประเมิน/,
    message: 'ห้ามบันทึกรายงานหรือผลประเมิน',
  },
];

const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** In-process store keyed by owner. The sandbox restarts with a fresh database, so this is a stand-in for SQLite FTS5. */
const store = new Map<string, Map<string, MemoryItem>>();

export function saveMemory(ownerId: string, rawText: string, now = Date.now()) {
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!text) throw new ToolError('empty', 'ข้อความว่าง');
  if (text.length > MAX_TEXT) throw new ToolError('too_long', `ยาวเกิน ${MAX_TEXT} ตัวอักษร`);
  for (const rule of SENSITIVE)
    if (rule.test.test(text)) throw new ToolError(rule.code, rule.message);
  const items = store.get(ownerId) ?? new Map<string, MemoryItem>();
  store.set(ownerId, items);
  const key = normalize(text);
  const existing = items.get(key);
  if (existing) {
    existing.updatedAt = now;
    return { id: existing.id, duplicate: true };
  }
  const id = crypto.randomUUID();
  items.set(key, { id, text, updatedAt: now });
  return { id, duplicate: false };
}

export function searchMemory(ownerId: string, query: string, limit = 5): MemoryItem[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  return [...(store.get(ownerId)?.values() ?? [])]
    .filter((item) => terms.every((term) => normalize(item.text).includes(term)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function resetMemory() {
  store.clear();
}
