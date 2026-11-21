import { z } from 'zod';

export const envSchema = z.object({
  PASSCODE: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  VERCEL_TOKEN: z.string().min(1),
  VERCEL_TEAM_ID: z.string().min(1),
  VERCEL_PROJECT_ID: z.string().min(1),
  DAILY_RUN_LIMIT: z.coerce.number().int().positive().default(60),
  IDLE_STOP_MINUTES: z.coerce.number().int().positive().default(10),
});

export type AgentConfig = z.infer<typeof envSchema>;
