import type { AgentDefinition } from './types';

export type PersonaId = Extract<AgentDefinition['id'], string>;

export { personas, persona } from '../../../../packages/shared/src/personas';
