import { Agent, Location, Model, Skill, type Plugin } from '@opencode/plugin';
import { schoolTool, type SchoolScope } from './school';
import { agents } from './agents';
import { jeng } from './agents/jeng';
import { kahootMcpServer, type KahootMcpConfig } from './kahoot-config';
import { KahootDrafts, kahootTool } from './kahoot-draft';
import { decide, permissionsFor } from './permissions';
import { activityActions } from './tools/teacher_activity';
import { recordActivity } from './state';
import { tools } from './tools';

export interface EmbeddedSkill {
  id: string;
  name: string;
  description: string;
  content: string;
}

interface RegistrationContext {
  mcp?: Pick<Plugin.Context['mcp'], 'transform'>;
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

const schoolCallbacks: Record<string, string> = {
  memory_save: 'เสนอข้อความให้เจ้าของบัญชีอนุมัติ ก่อนเก็บเป็นความจำถาวร',
  memory_search: 'ค้นข้อความที่เจ้าของบัญชีอนุมัติให้จำแล้ว',
  get_scores: 'อ่านคะแนนและคะแนนเต็มที่บันทึกในห้องที่เลือก',
  get_school_summary: 'อ่านยอดรวมห้อง นักเรียน คะแนน และรายงานของโรงเรียน',
  teacher_activity: 'อ่านจำนวนงานที่เสร็จและใบงานที่สร้างในวันก่อนหน้า',
  list_pending_approvals: 'อ่านคำขอที่รอการอนุมัติของโรงเรียน',
  get_approval: 'อ่านรายละเอียดคำขอในโรงเรียนตามรหัส',
};
const schoolLocalTools = new Set([
  'calc',
  'server_clock',
  'curriculum_lookup',
  'check_assessment',
  'save_assessment',
  'fraction_addition_form',
  'make_slides',
  'make_file',
  // Checked here by brief-guard, then forwarded so the school app can show it (see below).
  'publish_brief',
]);

export function createRuntimePlugin(
  increment: (name: string) => number,
  skills: readonly EmbeddedSkill[],
  kahoot?: KahootMcpConfig,
  toolOwner?: (
    sessionId: string,
    agent: string,
    signal: AbortSignal,
  ) => Promise<{ ownerId: string; classId?: string }>,
  resolveScope?: (sessionId: string) => Promise<SchoolScope>,
) {
  const drafts = new KahootDrafts();
  const rulesByAgent = new Map(agents.map((agent) => [agent.id, permissionsFor(agent, kahoot)]));
  return {
    id: 'crudex-agent-runtime',
    async setup(ctx: RegistrationContext) {
      if (kahoot) {
        if (!ctx.mcp) throw new Error('MCP registration unavailable');
        await ctx.mcp.transform((editor) => {
          // OpenCode normalizes MCP names before joining them, so overlapping prefixes can impersonate a tool.
          for (const [server] of editor.list()) {
            const prefix = server.replace(/[^a-zA-Z0-9_-]/g, '_') + '_';
            if (
              server !== kahootMcpServer &&
              jeng.mcpTools.some((action) => action.startsWith(prefix))
            ) {
              throw new Error('Ambiguous Kahoot MCP namespace');
            }
          }
          editor.set(kahootMcpServer, {
            type: 'remote',
            url: kahoot.url,
            headers: { 'x-crudex-kahoot-token': kahoot.token },
            oauth: false,
            codemode: false,
          });
        });
      }
      await ctx.permission.hook('evaluate', async (evaluation) => {
        const rules = rulesByAgent.get(evaluation.agent ?? '');
        evaluation.effect = decide(rules ?? [], evaluation.action, evaluation.resources);
        if (evaluation.effect !== 'allow' || !evaluation.action.startsWith(kahootMcpServer + '_'))
          return;
        if (resolveScope) {
          const scope = await resolveScope(evaluation.sessionID).catch(() => undefined);
          if (scope?.role !== 'teacher') {
            evaluation.effect = 'deny';
            return;
          }
        }
        if (
          evaluation.action === kahootTool &&
          !drafts.consume(evaluation.sessionID, evaluation.metadata?.input)
        ) {
          evaluation.effect = 'deny';
        }
      });

      await ctx.agent.transform((editor) => {
        for (const id of builtins) editor.remove(id);
        editor.default(agents.find(({ mode }) => mode === 'primary')?.id);
        for (const definition of agents) {
          editor.update(definition.id, (agent) => {
            agent.name = Agent.Name.make(definition.name);
            agent.description = definition.description;
            agent.mode = definition.mode;
            agent.system = resolveScope
              ? definition.instructions +
                '\nโหมดบัญชีโรงเรียน ใช้ข้อมูลจากเครื่องมือที่ผูกกับบัญชีเท่านั้น หากเครื่องมือไม่พร้อมให้บอกผู้ใช้ตามจริง ห้ามสร้างตัวเลข ลิงก์ หรือผลลัพธ์เอง'
              : definition.instructions;
            agent.model = Model.Ref.parse('openai/' + definition.model);
            agent.permissions = permissionsFor(definition, kahoot);
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
          const callback = Object.hasOwn(schoolCallbacks, tool.name);
          if (resolveScope && !callback && !schoolLocalTools.has(tool.name)) continue;
          editor.add({
            name: tool.name,
            description: resolveScope && callback ? schoolCallbacks[tool.name]! : tool.description,
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
              const scope = await resolveScope?.(call.sessionID);
              if (scope && callback) {
                const result = await schoolTool(scope, tool.name, input, call.signal);
                return { content: JSON.stringify(result) };
              }
              const identity = scope
                ? { scope, ownerId: scope.ownerId, classId: scope.classId ?? undefined }
                : await toolOwner?.(call.sessionID, call.agent, call.signal);
              const result = await tool.execute(input, {
                ...identity,
                count: increment(tool.name),
                agent: call.agent,
                sessionID: call.sessionID,
                signal: call.signal,
              });
              if (scope && tool.name === 'publish_brief') {
                await schoolTool(scope, 'publish_brief', input, call.signal);
              }
              const action = Object.hasOwn(activityActions, tool.name)
                ? activityActions[tool.name]
                : undefined;
              if (action && identity?.ownerId) recordActivity(identity.ownerId, action);
              if (
                kahoot &&
                call.agent === 'jeng' &&
                tool.name === 'check_assessment' &&
                result &&
                typeof result === 'object'
              ) {
                const kahootDraft = drafts.check(
                  call.sessionID,
                  input,
                  'ok' in result && result.ok === true,
                );
                return { content: JSON.stringify({ ...result, kahootDraft }) };
              }
              return { content: JSON.stringify(result) };
            },
          });
        }
      });
    },
  } satisfies Plugin.Plugin;
}
