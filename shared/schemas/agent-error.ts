import { z } from 'zod/v4';

export const AgentErrorSchema = z.object({
  agentName: z.string(),
  runId: z.string(),
  errorType: z.enum(['transient', 'recoverable', 'fatal']),
  message: z.string(),
  stack: z.string().optional(),
  occurredAt: z.string(),
});

export type AgentError = z.infer<typeof AgentErrorSchema>;
