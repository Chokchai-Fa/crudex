import { sampleClassId, sampleOwner } from '../data/sample';
import type { ToolContext } from './types';

/** Owner comes from the gateway; until it passes one, every session shares the sample teacher so state carries across agents. */
export function ownerOf({ ownerId }: ToolContext) {
  const id = ownerId ?? sampleOwner;
  return { id, key: `owner:${id}` };
}

export function classOf({ ownerId, classId }: ToolContext) {
  return classId ?? (ownerId === undefined ? sampleClassId : undefined);
}

export class ToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
