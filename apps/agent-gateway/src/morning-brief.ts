import { DurableObject } from 'cloudflare:workers';

const dayMs = 86_400_000;
const bangkokOffsetMs = 7 * 3_600_000;
const prompt =
  'สรุปเช้าวันนี้ให้ ผอ. ใช้เครื่องมืออ่านข้อมูลตัวอย่างเท่านั้น สรุปผลเรียนระดับห้อง งบประมาณ เอกสารรออนุมัติ งานครูเมื่อวาน และหนึ่งเรื่องที่ต้องตัดสินใจ ภายใน 7 บรรทัด ห้ามระบุชื่อ รหัส หรือคะแนนนักเรียนรายคน';
type Trigger = 'scheduled' | 'manual';

interface Brief {
  text: string;
  generatedAt: string;
  trigger: Trigger;
}

// Bangkok uses UTC+7 year-round, so 07:00 Bangkok coincides with UTC midnight.
export function nextMorning(now: number) {
  return (Math.floor(now / dayMs) + 1) * dayMs;
}

export function readBrief(stream: string) {
  let text = '';
  let done = false;
  for (const frame of stream.split(/\r?\n\r?\n/)) {
    if (!frame.startsWith('data: ')) continue;
    const event = JSON.parse(frame.slice(6));
    if (done || event.type === 'error') throw new Error('brief_incomplete');
    if (event.type === 'delta' && typeof event.text === 'string') text += event.text;
    if (event.type === 'done') done = true;
  }
  const lines = text.trim().split(/\r\n|[\r\n\u2028\u2029]/);
  // Sample identities are numbered (s-01, นักเรียนตัวอย่าง 01). Reject personal labels too.
  const individual =
    /(?:\bs[-_]\d+\b|นักเรียน\s*(?:ตัวอย่าง|เลขที่|รหัส|ชื่อ|คนที่)|(?:รหัส|ชื่อ|เลขที่)\s*นักเรียน|เด็กชาย|เด็กหญิง|ด\.\s*[ชญ]\.|[\w.+-]+@[\w.-]+\.[a-z]{2,})/iu;
  if (!done || !text.trim() || lines.length > 7 || text.length > 4000 || individual.test(text)) {
    throw new Error('brief_invalid');
  }
  return lines.join('\n');
}

export class MorningBrief extends DurableObject<Env> {
  private async run(origin: string, trigger: Trigger) {
    const upstream = await this.env.SANDBOX.getByName('main').fetch(
      new Request(origin + '/api/chat?role=principal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: 'rungchao', text: prompt }),
      }),
    );
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('text/event-stream')) {
      throw new Error('brief_unavailable');
    }
    const text = readBrief(await upstream.text());
    await this.ctx.storage.put<Brief>('latest', {
      text,
      generatedAt: new Date().toISOString(),
      trigger,
    });
  }

  override async fetch(request: Request) {
    const url = new URL(request.url);
    const manual = request.method === 'POST' && url.pathname === '/api/brief/run';
    if (!manual && !(request.method === 'GET' && url.pathname === '/api/brief')) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    const storage = this.ctx.storage;
    await storage.transaction(async (txn) => {
      if (!(await txn.get('origin'))) await txn.put('origin', url.origin);
      if ((await txn.getAlarm()) === null) await txn.setAlarm(nextMorning(Date.now()));
    });
    if (manual) {
      try {
        await this.run(url.origin, 'manual');
      } catch {
        return Response.json({ error: 'brief_unavailable' }, { status: 502 });
      }
    }
    return Response.json({
      latest: (await storage.get<Brief>('latest')) ?? null,
      nextRunAt: await storage.getAlarm(),
    });
  }

  override async alarm() {
    const storage = this.ctx.storage;
    const now = Date.now();
    const date = new Date(now + bangkokOffsetMs).toISOString().slice(0, 10);
    const origin = await storage.transaction(async (txn) => {
      await txn.setAlarm(nextMorning(now));
      if ((await txn.get('scheduledDate')) === date) return;
      const origin = await txn.get<string>('origin');
      if (origin) await txn.put('scheduledDate', date);
      return origin;
    });
    if (origin) await this.run(origin, 'scheduled');
  }
}
