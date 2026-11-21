import type { Plugin } from '@opencode/plugin';

type ToolEditor = Parameters<Parameters<Plugin.Context['tool']['transform']>[0]>[0];

export interface ToolDefinition {
  name: string;
  description: string;
  input: Extract<Parameters<ToolEditor['add']>[0]['input'], { type?: unknown }>;
  gate: 'allow' | 'ask';
  execute: (input: unknown, context: { count: number; signal: AbortSignal }) => unknown;
}
