import { Hono } from 'hono';
import type { AgentId } from '@repo/shared';
import { actorMiddleware } from '../middleware/actor';
import type { AppEnv } from '../types/app';

const directory: { id: AgentId; name: string; role: 'teacher' | 'principal' }[] = [
  { id: 'jaew', name: 'น้องแจ๋ว', role: 'teacher' },
  { id: 'jum', name: 'น้องจ๋า', role: 'teacher' },
  { id: 'jeng', name: 'พี่เจ๋ง', role: 'teacher' },
  { id: 'porn', name: 'ป้าพร', role: 'teacher' },
  { id: 'nun', name: 'น้องนุ่น', role: 'teacher' },
  { id: 'rungchao', name: 'รุ่งเช้า', role: 'principal' },
  { id: 'lekha_por', name: 'ลุงนิต', role: 'principal' },
];

export const agentDirectoryRoutes = new Hono<AppEnv>().get('/agents', actorMiddleware, (c) =>
  c.json({
    agents: directory
      .filter((agent) => agent.role === c.var.actor.role)
      .map(({ id, name }) => ({ id, name })),
  }),
);
