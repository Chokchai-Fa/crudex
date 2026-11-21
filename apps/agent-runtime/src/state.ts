import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runtimeStateSchema,
  type RuntimeState,
} from '../../../packages/shared/src/runtime-state.schema';

export type MemoryItem = RuntimeState['memory'][string][number];
export type ApprovalRecord = RuntimeState['approvals'][number];
export type Notification = RuntimeState['notifications'][number];
export type PublishedBrief = RuntimeState['briefs'][number];
export type InboxItem = RuntimeState['inbox'][number];

export const memory = new Map<string, Map<string, MemoryItem>>();
export const approvals: ApprovalRecord[] = [];
export const notifications: Notification[] = [];
export const briefs: PublishedBrief[] = [];
/** The demo test mailbox written by send_email. */
export const inbox: InboxItem[] = [];

export const normalizeMemory = (text: string) =>
  text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

function snapshot(): RuntimeState {
  return {
    version: 1,
    memory: Object.fromEntries(
      Array.from(memory, ([owner, items]) => [owner, [...items.values()]]),
    ),
    approvals,
    notifications,
    briefs,
    inbox,
  };
}

export function exportState(): RuntimeState {
  return structuredClone(snapshot());
}

function replaceState(state: RuntimeState) {
  memory.clear();
  for (const [owner, items] of Object.entries(state.memory)) {
    memory.set(owner, new Map(items.map((item) => [normalizeMemory(item.text), item])));
  }
  approvals.length = 0;
  notifications.length = 0;
  briefs.length = 0;
  inbox.length = 0;
  for (const item of state.approvals) approvals.push(item);
  for (const item of state.notifications) notifications.push(item);
  for (const item of state.briefs) briefs.push(item);
  for (const item of state.inbox) inbox.push(item);
}

function writeState(dataDir: string, state: RuntimeState) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = join(dataDir, 'state.json');
  const temp = file + '.tmp';
  writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
  renameSync(temp, file);
}

export function persistState() {
  const dataDir = process.env.DATA_DIR;
  if (dataDir) writeState(dataDir, snapshot());
}

export function importState(input: unknown) {
  const state = runtimeStateSchema.parse(input);
  const dataDir = process.env.DATA_DIR;
  if (dataDir) writeState(dataDir, state);
  replaceState(state);
}

export function loadState() {
  const dataDir = process.env.DATA_DIR;
  if (!dataDir) return;
  let json: string;
  try {
    json = readFileSync(join(dataDir, 'state.json'), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  replaceState(runtimeStateSchema.parse(JSON.parse(json)));
}
