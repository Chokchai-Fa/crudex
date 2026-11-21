import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runEventSchema, type RunEvent } from '@repo/shared';
import { api } from '@/lib/api-client';

async function replay(id: string, signal: AbortSignal) {
  const events: RunEvent[] = [];
  let cursor = 0;
  for (;;) {
    const response = await api.runs[':id'].events.$get(
      { param: { id } },
      { headers: { 'Last-Event-ID': String(cursor) }, init: { signal } },
    );
    if (!response.ok) throw new Error('อ่านประวัติคำตอบไม่สำเร็จ');
    if (response.status === 204) return events;
    const frames = (await response.text()).split(/\r?\n\r?\n/);
    let count = 0;
    for (const frame of frames) {
      const data = /^data: (.+)$/m.exec(frame);
      if (!data) continue;
      const next = Number(/^id: (\d+)$/m.exec(frame)?.[1]);
      if (!Number.isSafeInteger(next) || next <= cursor)
        throw new Error('ลำดับเหตุการณ์ไม่ถูกต้อง');
      cursor = next;
      count++;
      const event = runEventSchema.parse(JSON.parse(data[1]!));
      events.push(event);
      if (event.type === 'done' || event.type === 'error') return events;
    }
    if (count < 128) return events;
  }
}

export function useRunEvents(membershipId: string, id: string, active: boolean) {
  const stored = useQuery({
    queryKey: ['school-data', membershipId, 'events', id],
    enabled: !active,
    staleTime: Infinity,
    queryFn: ({ signal }) => replay(id, signal),
  });
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!active) return;
    const stream = new EventSource(api.runs[':id'].events.$path({ param: { id } }));
    let cursor = 0;
    stream.onmessage = (message) => {
      const next = Number(message.lastEventId);
      if (next <= cursor) return;
      try {
        const event = runEventSchema.parse(JSON.parse(message.data));
        cursor = next;
        setEvents((prev) => [...prev, event]);
        if (event.type === 'done' || event.type === 'error') stream.close();
      } catch {
        setError('อ่านเหตุการณ์ไม่ได้');
        stream.close();
      }
    };
    stream.onerror = () => {
      if (stream.readyState === EventSource.CLOSED) setError('การเชื่อมต่อกับโรงเรียนสิ้นสุดแล้ว');
    };
    return () => stream.close();
  }, [active, id]);
  return {
    events: stored.data ?? events,
    error: stored.error?.message ?? error,
    loading: !active && stored.isPending,
  };
}
