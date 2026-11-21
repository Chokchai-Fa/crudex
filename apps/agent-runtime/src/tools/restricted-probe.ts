import type { ToolDefinition } from './types';

export const restrictedProbe: ToolDefinition = {
  name: 'restricted_probe',
  description: 'A probe for verifying that tool bindings are enforced.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'ask',
  execute: () => ({ ok: true }),
};
