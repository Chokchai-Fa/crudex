export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  mode: 'primary' | 'subagent' | 'all';
  model: string;
  instructions: string;
  tools: readonly string[];
  mcpTools?: readonly (
    | 'crudex_kahoot_create_or_update_kahoot'
    | 'crudex_kahoot_get_kahoot_editor_url'
    | 'crudex_kahoot_get_kahoot'
  )[];
  skills: readonly string[];
  subagents: readonly string[];
}
