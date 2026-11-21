import { sampleClassId, sampleOwner } from '../data/sample';
import type { ToolContext } from './types';

/** Owner and class come from the session; the sample fallback exists only until the gateway passes them. */
export function identityOf(context: ToolContext) {
  return {
    ownerId: context.ownerId ?? sampleOwner,
    classId: context.classId ?? sampleClassId,
    fromSession: context.ownerId !== undefined && context.classId !== undefined,
  };
}

export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
