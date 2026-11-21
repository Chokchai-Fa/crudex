import type { SchoolScope } from '../school';
import type { Plugin } from '@opencode/plugin';

type ToolEditor = Parameters<Parameters<Plugin.Context['tool']['transform']>[0]>[0];

export interface ToolContext {
  scope?: SchoolScope;
  count: number;
  signal: AbortSignal;
  agent?: string;
  sessionID?: string;
  /** Set by the gateway from the signed-in teacher. */
  ownerId?: string;
  /** Set by the gateway from the teacher's class assignment. */
  classId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input: Extract<Parameters<ToolEditor['add']>[0]['input'], { type?: unknown }>;
  gate: 'allow' | 'ask';
  execute: (input: unknown, context: ToolContext) => unknown;
}
