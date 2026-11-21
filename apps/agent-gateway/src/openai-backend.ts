import { agentIdSchema, type AgentId } from '../../../packages/shared/src/runs.schema';
import { nun } from '../../agent-runtime/src/agents/nun';
import type { AgentDefinition } from '../../agent-runtime/src/agents/types';
import { schoolCallbacks } from '../../agent-runtime/src/school-callbacks';
import { calc } from '../../agent-runtime/src/tools/calc';
import type { ToolDefinition } from '../../agent-runtime/src/tools/types';
import studentInsight from '../../agent-runtime/skills/student-insight/SKILL.md';
import { callbackTool, streamAgent, type AgentTool, type Turn } from './openai-agent';

/**
 * Agents ported from the Vercel sandbox to OpenAI. They reuse the runtime's definitions, tools
 * and skills so both backends behave the same and either can serve a turn.
 */
const ported: Partial<Record<AgentId, { agent: AgentDefinition; skills: string[] }>> = {
  nun: { agent: nun, skills: [studentInsight] },
};

/** Pure tools that run inside the Worker. */
const localTools: Record<string, ToolDefinition> = { calc };

/** Input schemas for school API callbacks; the API validates the payload again. */
const callbackInputs: Record<string, object> = {
  get_scores: {
    type: 'object',
    properties: { classLabel: { type: 'string' } },
    additionalProperties: false,
  },
  memory_search: {
    type: 'object',
    properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 10 } },
    required: ['query'],
    additionalProperties: false,
  },
};

export interface BackendConfig {
  AGENT_BACKEND?: string;
  OPENAI_AGENTS?: string;
}

/** `AGENT_BACKEND = "vercel"` sends every turn to the sandbox, which is the rollback switch. */
export function usesOpenAI(env: BackendConfig) {
  return env.AGENT_BACKEND === 'openai';
}

/** The ported agents listed in `OPENAI_AGENTS`. Unknown or unported names are ignored. */
export function openaiAgents(env: BackendConfig): Set<AgentId> {
  if (!usesOpenAI(env)) return new Set();
  const ids = (env.OPENAI_AGENTS ?? '').split(',').map((id) => id.trim());
  return new Set(
    ids.flatMap((id) => {
      const parsed = agentIdSchema.safeParse(id);
      return parsed.success && ported[parsed.data] ? [parsed.data] : [];
    }),
  );
}

function stripFrontMatter(markdown: string) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function localTool(definition: ToolDefinition, turn: Turn, agent: string): AgentTool {
  const { $schema: _, ...parameters } = definition.input as Record<string, unknown>;
  return {
    name: definition.name,
    description: definition.description,
    parameters,
    async run(args, signal) {
      const input: unknown = JSON.parse(args || '{}');
      try {
        const result = await definition.execute(input, {
          count: 1,
          signal,
          agent,
          ownerId: turn.scope.ownerId,
          classId: turn.scope.classId ?? undefined,
        });
        return JSON.stringify(result);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'tool_failed', { cause: error });
      }
    },
  };
}

function toolsFor(agent: AgentDefinition, turn: Turn): AgentTool[] {
  return agent.tools.map((name) => {
    const description = schoolCallbacks[name];
    const input = callbackInputs[name];
    if (description && input) return callbackTool(turn, name, description, input);
    const local = localTools[name];
    if (local) return localTool(local, turn, agent.id);
    throw new Error(`Tool ${name} is not ported for ${agent.id}`);
  });
}

export function specFor(id: AgentId, turn: Turn) {
  const entry = ported[id];
  if (!entry) return;
  const { agent, skills } = entry;
  const instructions = [agent.instructions, ...skills.map(stripFrontMatter)].join('\n\n');
  return { model: agent.model, instructions, tools: toolsFor(agent, turn) };
}

/**
 * Runs the turn on OpenAI when its agent is enabled there. Returns undefined to keep the sandbox:
 * the agent isn't enabled, or OpenAI refused the first request.
 */
export async function openaiReply(key: string, env: BackendConfig, turn: Turn) {
  if (!openaiAgents(env).has(turn.agentId)) return;
  const spec = specFor(turn.agentId, turn);
  if (!spec) return;
  console.log('openai_agent', turn.agentId);
  return streamAgent(key, turn, spec);
}
