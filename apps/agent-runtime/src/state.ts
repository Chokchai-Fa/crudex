import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { runtimeStateSchema } from '../../../packages/shared/src/runtime-state.schema';

const formRecordSchema = z
  .strictObject({
    formId: z.string().regex(/^[A-Za-z0-9_-]+$/),
    classId: z.string().min(1),
    ownerId: z.string().min(1),
    title: z.string().min(1),
    topic: z.string().min(1),
    questionTopics: z.array(z.string().min(1)).max(30),
    maxScore: z.int().min(1).max(30),
    createdAt: z.number(),
  })
  .refine(({ questionTopics, maxScore }) => questionTopics.length === maxScore);
const stateSchema = runtimeStateSchema
  .extend({ forms: z.record(z.string(), z.array(formRecordSchema)).default({}) })
  .refine(
    ({ forms }) => {
      const ids = new Set<string>();
      for (const [ownerId, records] of Object.entries(forms)) {
        for (const form of records) {
          if (form.ownerId !== ownerId || ids.has(form.formId)) return false;
          ids.add(form.formId);
        }
      }
      return true;
    },
    { path: ['forms'] },
  );
type RuntimeState = z.infer<typeof stateSchema>;
export type FormRecord = z.infer<typeof formRecordSchema>;

export type MemoryItem = RuntimeState['memory'][string][number];
export type ApprovalRecord = RuntimeState['approvals'][number];
export type Notification = RuntimeState['notifications'][number];
export type PublishedBrief = RuntimeState['briefs'][number];
export type InboxItem = RuntimeState['inbox'][number];
export type ActivityEntry = RuntimeState['activity'][number];

export const memory = new Map<string, Map<string, MemoryItem>>();
export const approvals: ApprovalRecord[] = [];
export const notifications: Notification[] = [];
export const briefs: PublishedBrief[] = [];
/** The demo test mailbox written by send_email. */
export const inbox: InboxItem[] = [];
export const activity: ActivityEntry[] = [];
const forms = new Map<string, FormRecord[]>();

export function recordForm(form: FormRecord) {
  for (const records of forms.values()) {
    if (records.some(({ formId }) => formId === form.formId)) return;
  }
  const previous = forms.get(form.ownerId);
  let kept = 0;
  const older = (previous ?? []).filter(({ classId }) => {
    if (classId !== form.classId) return true;
    kept++;
    return kept <= 5;
  });
  forms.set(form.ownerId, [form, ...older]);
  try {
    persistState();
  } catch (error) {
    if (previous) forms.set(form.ownerId, previous);
    else forms.delete(form.ownerId);
    throw error;
  }
}

export function latestForm(ownerId: string, classId: string) {
  return forms.get(ownerId)?.find((form) => form.classId === classId);
}

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
    activity,
    forms: Object.fromEntries(forms),
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
  forms.clear();
  for (const [owner, records] of Object.entries(state.forms)) forms.set(owner, records);
  approvals.length = 0;
  notifications.length = 0;
  briefs.length = 0;
  inbox.length = 0;
  activity.length = 0;
  for (const item of state.approvals) approvals.push(item);
  for (const item of state.notifications) notifications.push(item);
  for (const item of state.briefs) briefs.push(item);
  for (const item of state.inbox) inbox.push(item);
  for (const item of state.activity) activity.push(item);
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
  const state = stateSchema.parse(input);
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
  replaceState(stateSchema.parse(JSON.parse(json)));
}

const MAX_ACTIVITY = 500;

/** Remember one piece of teacher work (no content, no student data). Oldest entries are dropped first. */
export function recordActivity(ownerId: string, action: string, at = Date.now()) {
  activity.push({ ownerId, action, at });
  if (activity.length > MAX_ACTIVITY) activity.splice(0, activity.length - MAX_ACTIVITY);
  persistState();
}
