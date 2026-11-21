import {
  runtimeStateMaxBytes,
  runtimeStatePath,
} from '../../../packages/shared/src/runtime-state.schema';
import { upstreamHeader } from './sandbox';

interface Runtime {
  owner?: string;
  url: string;
  token: string;
}

// Leave room for storage serialization overhead below the 128 KiB per-value budget.
const chunkBytes = 120 * 1024;
const stateKey = (owner?: string) => (owner ? 'runtimeState:' + owner : 'runtimeState');
const chunkKey = (key: string, index: number) => key + ':' + index;

async function readSnapshot(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  const buffer = new Uint8Array(runtimeStateMaxBytes);
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.byteLength > buffer.byteLength) {
        await reader.cancel();
        return;
      }
      buffer.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (length) return buffer.buffer.slice(0, length);
}

export async function saveRuntimeState(storage: DurableObjectStorage, runtime: Runtime) {
  try {
    const response = await fetch(new URL(runtimeStatePath, runtime.url), {
      headers: { [upstreamHeader]: runtime.token },
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json')) {
      await response.body?.cancel();
      return;
    }
    const snapshot = await readSnapshot(response);
    if (!snapshot) return;

    const key = stateKey(runtime.owner);
    const count = Math.ceil(snapshot.byteLength / chunkBytes);
    const entries: Record<string, number | ArrayBuffer> = { [key]: count };
    for (let i = 0; i < count; i++) {
      entries[chunkKey(key, i)] = snapshot.slice(i * chunkBytes, (i + 1) * chunkBytes);
    }
    await storage.transaction(async (txn) => {
      const previousCount = (await txn.get<number>(key)) ?? 0;
      await txn.put(entries);
      if (previousCount > count) {
        await txn.delete(
          Array.from({ length: previousCount - count }, (_, i) => chunkKey(key, i + count)),
        );
      }
    });
  } catch {
    // Keep the previous snapshot if the sandbox or storage is unavailable.
  }
}

export async function restoreRuntimeState(storage: DurableObjectStorage, runtime: Runtime) {
  const key = stateKey(runtime.owner);
  const count = await storage.get<number>(key);
  if (count === undefined) return;
  const keys = Array.from({ length: count }, (_, i) => chunkKey(key, i));
  const chunks = await storage.get<ArrayBuffer>(keys);
  const body = new Blob(
    keys.map((key) => {
      const chunk = chunks.get(key);
      if (!chunk) throw new Error('Incomplete runtime state');
      return chunk;
    }),
  );
  const response = await fetch(new URL(runtimeStatePath, runtime.url), {
    method: 'PUT',
    headers: { [upstreamHeader]: runtime.token, 'content-type': 'application/json' },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
  });
  await response.body?.cancel();
  if (!response.ok) throw new Error('Runtime state restore failed');
}
