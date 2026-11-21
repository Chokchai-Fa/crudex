import { z } from 'zod';

export const envSchema = z.object({
  PASSCODE: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  KAHOOT_MCP_ENABLED: z.enum(['true', 'false']).optional(),
  SCHOOL_BOT_APPS_SCRIPT_URL: z.url().optional(),
  VERCEL_TOKEN: z.string().min(1),
  VERCEL_TEAM_ID: z.string().min(1),
  VERCEL_PROJECT_ID: z.string().min(1),
  RUNTIME_REVISION: z.string().min(1).default('local'),
  DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(60),
  DAILY_RUN_LIMIT_OVERRIDES: z.record(z.iso.date(), z.number().int().positive()).optional(),
  IDLE_STOP_MINUTES: z.coerce.number().int().positive().default(10),
  AGENT_BACKEND: z.enum(['vercel', 'openai']).default('vercel'),
  OPENAI_AGENTS: z.string().default(''),
});

export type AgentConfig = z.infer<typeof envSchema>;
