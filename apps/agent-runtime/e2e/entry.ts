import { createRuntimePlugin } from '../src/plugin';

const counts = new Map<string, number>();
export default createRuntimePlugin((name) => {
  const next = (counts.get(name) ?? 0) + 1;
  counts.set(name, next);
  return next;
}, []);
