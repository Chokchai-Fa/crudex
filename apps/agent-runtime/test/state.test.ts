import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { exportState, importState, loadState } from '../src/state';
import {
  addApproval,
  approvals,
  notifications,
  type ClaimSnapshot,
} from '../src/tools/approval-store';
import { decideApproval } from '../src/tools/decide_approval';
import { saveMemory, searchMemory } from '../src/tools/memory-store';
import { testMailbox } from '../src/tools/inbox';
import { briefs, publishBrief } from '../src/tools/publish_brief';
import { sendEmail } from '../src/tools/send_email';

const emptyState = { version: 1, memory: {}, approvals: [], notifications: [], briefs: [] };
const owner = 'owner:teacher-a';
const context = { count: 1, signal: new AbortController().signal, ownerId: 'teacher-a' };
const claim: ClaimSnapshot = {
  claimId: 'claim-1',
  label: 'Sample claim',
  date: '1 พฤศจิกายน 2569',
  budgetCode: 'A24',
  purpose: 'Graph paper for class',
  rows: [{ name: 'Paper', qty: 2, unitPrice: 5, amount: 10 }],
  total: 10,
  remainingAfter: 50,
  overBudget: false,
};

beforeEach(() => {
  vi.stubEnv('DATA_DIR', undefined);
  importState(emptyState);
});

afterEach(() => vi.unstubAllEnvs());

it('restores memory search, approvals, notifications and briefs through a JSON snapshot', () => {
  const { id } = saveMemory(owner, 'Use graph paper', 10);
  saveMemory('owner:teacher-b', 'Use colored graph paper', 20);
  const approval = addApproval(context.ownerId, claim, 'For next term', 30);
  decideApproval.execute({ approvalId: approval.id, decision: 'approve' }, context);
  publishBrief.execute({ text: 'สรุปเช้าวันเสาร์\n1. ภาพรวมห้องตัวอย่าง' }, context);
  const stores = { approvals, notifications, briefs };
  const snapshot = exportState();
  const encoded = JSON.stringify(snapshot);

  importState(emptyState);
  expect(searchMemory(owner, 'graph')).toEqual([]);
  expect(approvals).toHaveLength(0);
  expect(notifications).toHaveLength(0);
  expect(briefs).toHaveLength(0);
  importState(JSON.parse(encoded));

  expect(approvals).toBe(stores.approvals);
  expect(notifications).toBe(stores.notifications);
  expect(briefs).toBe(stores.briefs);
  expect(searchMemory(owner, 'GRAPH paper')).toEqual([
    { id, text: 'Use graph paper', updatedAt: 10 },
  ]);
  expect(saveMemory(owner, 'USE graph paper', 40)).toEqual({ id, duplicate: true });
  expect(approvals).toEqual(snapshot.approvals);
  expect(notifications).toEqual(snapshot.notifications);
  expect(briefs).toEqual(snapshot.briefs);
  expect(approvals[0]).toMatchObject({ status: 'approved', claim });
  expect(notifications.map(({ to }) => to)).toEqual(['porn', 'teacher-a']);
  expect(briefs[0]).toMatchObject({ text: 'สรุปเช้าวันเสาร์\n1. ภาพรวมห้องตัวอย่าง' });
});

it('rejects malformed nested records without replacing existing state', () => {
  saveMemory(owner, 'Use graph paper');
  const snapshot = exportState();
  expect(() => importState({ ...snapshot, approvals: [{ claim }] })).toThrow();
  expect(exportState()).toEqual(snapshot);
});

it('writes through tool mutations and reloads the latest state.json', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'crudex-agent-state-'));
  vi.stubEnv('DATA_DIR', dataDir);
  const readStateFile = async () => JSON.parse(await readFile(join(dataDir, 'state.json'), 'utf8'));
  try {
    loadState();
    const { id } = saveMemory(owner, 'Use graph paper', 10);
    expect(await readStateFile()).toMatchObject({ memory: { [owner]: [{ id, updatedAt: 10 }] } });
    saveMemory(owner, 'Use  graph paper', 20);
    expect(await readStateFile()).toMatchObject({ memory: { [owner]: [{ id, updatedAt: 20 }] } });
    const approval = addApproval(context.ownerId, claim, '', 30);
    expect(await readStateFile()).toMatchObject({
      approvals: [{ id: approval.id, status: 'pending' }],
    });
    publishBrief.execute({ text: 'สรุปเช้าวันเสาร์\n1. ภาพรวมห้องตัวอย่าง' }, context);
    expect(await readStateFile()).toMatchObject({
      briefs: [{ text: 'สรุปเช้าวันเสาร์\n1. ภาพรวมห้องตัวอย่าง' }],
    });
    decideApproval.execute(
      { approvalId: approval.id, decision: 'return', reason: 'Check dates' },
      context,
    );
    const snapshot = exportState();
    expect(await readdir(dataDir)).toEqual(['state.json']);

    vi.stubEnv('DATA_DIR', undefined);
    importState(emptyState);
    vi.stubEnv('DATA_DIR', dataDir);
    loadState();

    expect(exportState()).toEqual(snapshot);
    expect(searchMemory(owner, 'graph')[0]?.updatedAt).toBe(20);
    expect(approvals[0]).toMatchObject({ status: 'returned', reason: 'Check dates' });
    expect(notifications).toHaveLength(2);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

it('a new sandbox with an empty DATA_DIR gets memory, approvals, briefs and inbox back from the gateway snapshot', async () => {
  const oldSandbox = await mkdtemp(join(tmpdir(), 'crudex-old-sandbox-'));
  const newSandbox = await mkdtemp(join(tmpdir(), 'crudex-new-sandbox-'));
  try {
    vi.stubEnv('DATA_DIR', oldSandbox);
    loadState();
    saveMemory(owner, 'ม.2/1 ชอบเรียนด้วยภาพ', 10);
    addApproval(context.ownerId, claim, 'ขอเบิก', 20);
    publishBrief.execute({ text: 'สรุปเช้าวันเสาร์\n1. สรุปตัวอย่างสำหรับ ผอ.' }, context);
    await sendEmail.execute({ to: 'x', subject: 'ตัวอย่าง', body: 'ทดสอบ' }, context);
    // The gateway keeps this GET /__state body in Durable Object storage.
    const checkpoint = JSON.stringify(exportState());

    // Sandbox is recreated: process memory and DATA_DIR are both gone.
    vi.stubEnv('DATA_DIR', undefined);
    importState(emptyState);
    vi.stubEnv('DATA_DIR', newSandbox);
    loadState();
    expect(searchMemory(owner, 'ม.2/1')).toEqual([]);
    expect(testMailbox).toHaveLength(0);

    // Gateway restores with PUT /__state before the first chat.
    importState(JSON.parse(checkpoint));
    expect(searchMemory(owner, 'ม.2/1')[0]?.text).toBe('ม.2/1 ชอบเรียนด้วยภาพ');
    expect(approvals[0]).toMatchObject({ status: 'pending', note: 'ขอเบิก' });
    expect(briefs[0]).toMatchObject({ text: 'สรุปเช้าวันเสาร์\n1. สรุปตัวอย่างสำหรับ ผอ.' });
    expect(testMailbox[0]).toMatchObject({ to: 'test-mailbox', subject: 'ตัวอย่าง' });
    expect(JSON.parse(await readFile(join(newSandbox, 'state.json'), 'utf8')).inbox).toHaveLength(
      1,
    );
  } finally {
    await rm(oldSandbox, { recursive: true, force: true });
    await rm(newSandbox, { recursive: true, force: true });
  }
});

it('accepts snapshots taken before the inbox was stored', () => {
  testMailbox.push({ id: 'm', to: 'test-mailbox', subject: 's', body: 'b', createdAt: 1 });
  importState(emptyState);
  expect(exportState().inbox).toEqual([]);
});
