export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  mode: 'primary' | 'subagent';
  model: string;
  instructions: string;
  tools: readonly string[];
  skills: readonly string[];
  subagents: readonly string[];
}
