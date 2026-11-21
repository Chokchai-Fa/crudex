import type { Agent } from '@opencode/plugin';
import type { AgentDefinition } from './agents/types';
import type { KahootMcpConfig } from './kahoot-config';
import { tools } from './tools';

type Rule = Agent.Info['permissions'][number];
type Effect = Rule['effect'];

export function permissionsFor(definition: AgentDefinition, kahoot?: KahootMcpConfig): Rule[] {
  const rules: Rule[] = [{ action: '*', resource: '*', effect: 'deny' }];
  for (const tool of tools) {
    if (definition.tools.includes(tool.name)) {
      rules.push({ action: tool.name, resource: '*', effect: tool.gate });
    }
  }
  if (kahoot && definition.id === 'jeng') {
    for (const action of definition.mcpTools ?? []) {
      rules.push({ action, resource: '*', effect: 'allow' });
    }
  }
  for (const id of definition.skills) {
    rules.push({ action: 'skill', resource: id, effect: 'allow' });
  }
  for (const id of definition.subagents) {
    rules.push({ action: 'subagent', resource: id, effect: 'allow' });
  }
  return rules;
}

function matches(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;
  const escaped = pattern.split('*').map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'));
  return new RegExp('^' + escaped.join('.*') + '$', 's').test(value);
}

export function decide(
  rules: readonly Rule[],
  action: string,
  resources: readonly string[],
): Effect {
  let result: Effect = 'allow';
  for (const resource of resources.length ? resources : ['*']) {
    const rule = rules.findLast(
      (rule) => matches(rule.action, action) && matches(rule.resource, resource),
    );
    if (!rule || rule.effect === 'deny') return 'deny';
    if (rule.effect === 'ask') result = 'ask';
  }
  return result;
}
