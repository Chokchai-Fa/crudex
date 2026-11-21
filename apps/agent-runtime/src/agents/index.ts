import { jaew } from './jaew';
import { jeng } from './jeng';
import { jum } from './jum';
import { nun } from './nun';
import { porn } from './porn';
import { testAgent } from './test-agent';
import type { AgentDefinition } from './types';

export const teacherAgents: readonly AgentDefinition[] = [jaew, jum, jeng, porn, nun];
export const agents: readonly AgentDefinition[] = [...teacherAgents, testAgent];
