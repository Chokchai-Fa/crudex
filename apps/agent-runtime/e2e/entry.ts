import { readFileSync } from 'node:fs';
import { createRuntimePlugin, type EmbeddedSkill } from '../src/plugin';

const counts = new Map<string, number>();
export default createRuntimePlugin(
  (name) => {
    const next = (counts.get(name) ?? 0) + 1;
    counts.set(name, next);
    return next;
  },
  process.env.E2E_SKILLS_FILE
    ? (JSON.parse(readFileSync(process.env.E2E_SKILLS_FILE, 'utf8')) as EmbeddedSkill[])
    : [],
);
