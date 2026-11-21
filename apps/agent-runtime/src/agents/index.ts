import { jaew } from './jaew';
import { jeng } from './jeng';
import { jum } from './jum';
import { lekha_por } from './lekha_por';
import { nun } from './nun';
import { porn } from './porn';
import { rungchao } from './rungchao';
import { testAgent } from './test-agent';
import type { AgentDefinition } from './types';

export const teacherAgents: readonly AgentDefinition[] = [jaew, jum, jeng, porn, nun];
export const principalAgents: readonly AgentDefinition[] = [rungchao, lekha_por];
export const agents: readonly AgentDefinition[] = [...teacherAgents, ...principalAgents, testAgent];
