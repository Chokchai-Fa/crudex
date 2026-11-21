import { Agent, Location, Model, Skill, type Plugin } from '@opencode/plugin';
import { agents } from './agents';
import { decide, permissionsFor } from './permissions';
import { tools } from './tools';

export interface EmbeddedSkill {
  id: string;
  name: string;
  description: string;
  content: string;
}

interface RegistrationContext {
  agent: Pick<Plugin.Context['agent'], 'transform'>;
  tool: Pick<Plugin.Context['tool'], 'transform'>;
  skill: Pick<Plugin.Context['skill'], 'transform'>;
  permission: Pick<Plugin.Context['permission'], 'hook' | 'assert'>;
}

class ToolNotBound extends Error {
  readonly code = 'tool_not_bound';

  constructor(toolName: string, agentId: string) {
    super(`tool_not_bound: ${toolName} is unavailable to ${agentId}`);
  }
}

const builtins = ['build', 'plan', 'general', 'explore'];
const definitions = new Map(agents.map((agent) => [agent.id, agent]));
const rulesByAgent = new Map(agents.map((agent) => [agent.id, permissionsFor(agent)]));

export function createRuntimePlugin(
  increment: (name: string) => number,
  skills: readonly EmbeddedSkill[],
) {
  return {
    id: 'crudex-agent-runtime',
    async setup(ctx: RegistrationContext) {
      await ctx.permission.hook('evaluate', (evaluation) => {
        const rules = rulesByAgent.get(evaluation.agent ?? '');
        evaluation.effect = decide(rules ?? [], evaluation.action, evaluation.resources);
      });

      await ctx.agent.transform((editor) => {
        for (const id of builtins) editor.remove(id);
        editor.default(agents.find(({ mode }) => mode === 'primary')?.id);
        for (const definition of agents) {
          editor.update(definition.id, (agent) => {
            agent.name = Agent.Name.make(definition.name);
            agent.description = definition.description;
            agent.mode = definition.mode;
            agent.system = definition.instructions;
            agent.model = Model.Ref.parse('openai/' + definition.model);
            agent.permissions = permissionsFor(definition);
          });
        }
      });

      await ctx.skill.transform((editor) => {
        for (const skill of skills) {
          editor.add({
            ...skill,
            id: Skill.ID.make(skill.id),
            name: Skill.Name.make(skill.name),
            path: Location.Ref.fields.directory.make(`/embedded-skills/${skill.id}/SKILL.md`),
          });
        }
      });

      await ctx.tool.transform((editor) => {
        for (const tool of tools) {
          editor.add({
            name: tool.name,
            description: tool.description,
            input: tool.input,
            options: { codemode: false },
            async execute(input, call) {
              if (!definitions.get(call.agent)?.tools.includes(tool.name)) {
                throw new ToolNotBound(tool.name, call.agent);
              }
              await ctx.permission.assert({
                sessionID: call.sessionID,
                agent: call.agent,
                action: tool.name,
                resources: ['*'],
              });
              const result = await tool.execute(input, {
                count: increment(tool.name),
                signal: call.signal,
              });
              return { content: JSON.stringify(result) };
            },
          });
        }
      });
    },
  } satisfies Plugin.Plugin;
}
