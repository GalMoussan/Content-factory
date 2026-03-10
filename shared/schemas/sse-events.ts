import { z } from 'zod/v4';

const PipelineStartedSchema = z.object({
  type: z.literal('pipeline:started'),
  runId: z.string(),
  timestamp: z.string(),
});

const PipelineCompletedSchema = z.object({
  type: z.literal('pipeline:completed'),
  runId: z.string(),
  timestamp: z.string(),
});

const PipelineFailedSchema = z.object({
  type: z.literal('pipeline:failed'),
  runId: z.string(),
  error: z.string().optional(),
  timestamp: z.string(),
});

const AgentStartedSchema = z.object({
  type: z.literal('agent:started'),
  runId: z.string(),
  agentName: z.string(),
  timestamp: z.string(),
});

const AgentCompletedSchema = z.object({
  type: z.literal('agent:completed'),
  runId: z.string(),
  agentName: z.string(),
  durationMs: z.number(),
  timestamp: z.string(),
});

const AgentFailedSchema = z.object({
  type: z.literal('agent:failed'),
  runId: z.string(),
  agentName: z.string(),
  error: z.string(),
  timestamp: z.string(),
});

export const SSEEventSchema = z.discriminatedUnion('type', [
  PipelineStartedSchema,
  PipelineCompletedSchema,
  PipelineFailedSchema,
  AgentStartedSchema,
  AgentCompletedSchema,
  AgentFailedSchema,
]);

export type SSEEvent = z.infer<typeof SSEEventSchema>;
