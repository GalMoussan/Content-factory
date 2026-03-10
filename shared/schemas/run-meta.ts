import { z } from 'zod/v4';

export const RunMetaSchema = z.object({
  runId: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'dead-letter']),
  triggeredBy: z.enum(['cron', 'manual', 'api']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
});

export type RunMeta = z.infer<typeof RunMetaSchema>;
