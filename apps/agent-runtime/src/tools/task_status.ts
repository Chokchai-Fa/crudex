import { z } from 'zod';
import { ToolError } from './identity';
import { validatedTool } from './validated';

interface Task {
  taskId: string;
  agent: string;
  summary: string;
  status: 'running' | 'done' | 'failed';
}

/** Mock: the real status comes from opencode child sessions once the gateway exposes them. */
const tasks: Task[] = [
  {
    taskId: 't-sample-1',
    agent: 'jum',
    summary: 'ตัวอย่าง: ทำใบงานเศษส่วน ป.5/2 10 ข้อ',
    status: 'done',
  },
  {
    taskId: 't-sample-2',
    agent: 'porn',
    summary: 'ตัวอย่าง: ร่างใบเบิกกระดาษ A4',
    status: 'running',
  },
];

export const taskStatus = validatedTool(z.strictObject({ taskId: z.string().optional() }), {
  name: 'task_status',
  description: 'ถามความคืบหน้าของงานที่ส่งต่อให้ agent อื่น (ตัวจำลอง: คืนข้อมูลตัวอย่าง)',
  gate: 'allow',
  execute: ({ taskId }) => {
    if (!taskId) return { mode: 'mock', tasks };
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) throw new ToolError('not_found', `ไม่พบงาน ${taskId}`);
    return { mode: 'mock', tasks: [task] };
  },
});
