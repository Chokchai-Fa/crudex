import { useEffect, useState } from 'react';
import { runEventSchema, type RunEvent } from '@repo/shared';
import { api } from '@/lib/api-client';

// Mount for one run. EventSource replays from Last-Event-ID after a short response.
export function useRunEvents(id: string) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const stream = new EventSource(api.runs[':id'].events.$path({ param: { id } }));
    let lastId = 0;
    stream.onmessage = (message) => {
      const cursor = Number(message.lastEventId);
      if (cursor <= lastId) return;
      try {
        const event = runEventSchema.parse(JSON.parse(message.data));
        lastId = cursor;
        setEvents((previous) => [...previous, event]);
        if (event.type === 'done' || event.type === 'error') stream.close();
      } catch {
        setError('อ่านรายละเอียดงานจากโรงเรียนไม่ได้');
        stream.close();
      }
    };
    stream.onerror = () => {
      if (stream.readyState === EventSource.CLOSED)
        setError('การเชื่อมต่อรายละเอียดงานสิ้นสุดแล้ว');
    };
    return () => stream.close();
  }, [id]);
  return { events, error };
}
