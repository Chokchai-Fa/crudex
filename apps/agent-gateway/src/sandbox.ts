import type { Sandbox } from '@vercel/sandbox';
import type { AgentConfig } from './env';
import { kahootMcpPath } from './kahoot-mcp';

export const archivePath = '/__sandbox/app.tgz';
export const upstreamHeader = 'x-crudex-upstream-token';
const port = 8790;
export const sandboxTimeout = 45 * 60_000;
export const rotateAfter = 40 * 60_000;
const workDir = '/tmp/crudex-agent';

const installApp = `
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = '${workDir}';
await mkdir(root + '/app', { recursive: true });
const response = await fetch(process.env.ARCHIVE_URL, {
  headers: { '${upstreamHeader}': process.env.BOOT_TOKEN },
  redirect: 'error',
  signal: AbortSignal.timeout(30_000)
});
if (!response.ok) throw new Error('Runtime download failed: HTTP ' + response.status);
const archive = root + '/app.tgz';
await writeFile(archive, Buffer.from(await response.arrayBuffer()));
execFileSync('tar', ['-xzf', archive, '-C', root + '/app']);
await unlink(archive);
`;

export function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function credentials(config: AgentConfig) {
  return {
    token: config.VERCEL_TOKEN,
    teamId: config.VERCEL_TEAM_ID,
    projectId: config.VERCEL_PROJECT_ID,
    // Pass the Worker's fetch so the SDK uses workerd's network implementation.
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
  };
}

export async function createSandbox(config: AgentConfig) {
  const { Sandbox } = await import('@vercel/sandbox');
  return Sandbox.create({
    ...credentials(config),
    image: 'vercel/sandbox/node:24',
    ports: [port],
    timeout: sandboxTimeout,
    resources: { vcpus: 2 },
    tags: { app: 'crudex-agent' },
    persistent: false,
    signal: AbortSignal.timeout(45_000),
  });
}

export async function bootSandbox(
  sandbox: Sandbox,
  config: AgentConfig,
  origin: string,
  bootToken: string,
  upstreamToken: string,
  owner?: string,
  kahootToken?: string,
) {
  const setup = await sandbox.runCommand({
    cmd: 'node',
    args: ['--input-type=module', '-e', installApp],
    cwd: '/',
    env: { ARCHIVE_URL: origin + archivePath, BOOT_TOKEN: bootToken },
    signal: AbortSignal.timeout(40_000),
  });
  if (setup.exitCode !== 0) throw new Error('Runtime installation failed');

  await sandbox.runCommand({
    cmd: 'node',
    args: ['server.mjs'],
    cwd: workDir + '/app',
    env: {
      OPENAI_API_KEY: config.OPENAI_API_KEY,
      KAHOOT_MCP_ENABLED: config.KAHOOT_MCP_ENABLED ?? 'false',
      ...(kahootToken && {
        KAHOOT_MCP_URL: origin + kahootMcpPath,
        KAHOOT_MCP_TOKEN: kahootToken,
      }),
      ...(config.SCHOOL_BOT_APPS_SCRIPT_URL && {
        SCHOOL_BOT_APPS_SCRIPT_URL: config.SCHOOL_BOT_APPS_SCRIPT_URL,
      }),
      ...(owner && { SCHOOL_OWNER: owner }),
      UPSTREAM_TOKEN: upstreamToken,
      DATA_DIR: workDir + '/data',
    },
    detached: true,
    signal: AbortSignal.timeout(15_000),
  });

  const url = sandbox.domain(port);
  const deadline = AbortSignal.timeout(45_000);
  while (!deadline.aborted) {
    const response = await fetch(url + '/__health', {
      headers: { [upstreamHeader]: upstreamToken },
      redirect: 'manual',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(3_000)]),
    }).catch(() => undefined);
    if (response) {
      await response.body?.cancel();
      if (response.ok) return url;
    }
    if (!deadline.aborted) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Runtime health check timed out');
}

export async function stopSandbox(config: AgentConfig, name: string) {
  const { APIError, Sandbox } = await import('@vercel/sandbox');
  const signal = AbortSignal.timeout(15_000);
  try {
    const sandbox = await Sandbox.get({ ...credentials(config), name, signal });
    if (sandbox.status === 'pending' || sandbox.status === 'running') {
      await sandbox.stop({ signal });
    }
  } catch (error) {
    if (!(error instanceof APIError && [404, 410].includes(error.response.status))) throw error;
  }
}
