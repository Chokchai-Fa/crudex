export interface KahootMcpConfig {
  url: string;
  token: string;
}

export function readKahootConfig(env: NodeJS.ProcessEnv): KahootMcpConfig | undefined {
  const { KAHOOT_MCP_ENABLED: enabled, KAHOOT_MCP_URL: url, KAHOOT_MCP_TOKEN: token } = env;
  if (enabled !== 'true' || !url || !token) return;
  const target = URL.parse(url);
  if (!target || target.username || target.password) return;
  if (
    target.protocol === 'https:' ||
    (target.protocol === 'http:' && target.hostname === 'localhost')
  )
    return { url, token };
}
