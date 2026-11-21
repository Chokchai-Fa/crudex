import { z } from 'zod';
import { ToolError } from './identity';
import type { ToolContext, ToolDefinition } from './types';

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.join('.');
  throw new ToolError('invalid_input', field ? `ข้อมูลไม่ถูกต้อง: ${field}` : 'ข้อมูลไม่ถูกต้อง');
}

export function validatedTool<S extends z.ZodType>(
  schema: S,
  definition: Omit<ToolDefinition, 'input' | 'execute'> & {
    execute: (input: z.output<S>, context: ToolContext) => unknown;
  },
): ToolDefinition {
  return {
    ...definition,
    input: z.toJSONSchema(schema),
    execute: async (input, context) => definition.execute(parseInput(schema, input), context),
  };
}

export const nonBlank = z
  .string()
  .min(1)
  .refine((text) => text.trim().length > 0);
