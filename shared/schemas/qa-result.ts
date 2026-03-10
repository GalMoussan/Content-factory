import { z } from 'zod/v4';

export const QADimensionSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  issues: z.array(z.string()),
});

export type QADimension = z.infer<typeof QADimensionSchema>;

export const QAResultSchema = z.object({
  topicId: z.string(),
  overallScore: z.number(),
  verdict: z.enum(['approved', 'rejected', 'flagged']),
  dimensions: z.array(QADimensionSchema).length(6),
  verdictReason: z.string(),
  evaluatedAt: z.string(),
});

export type QAResult = z.infer<typeof QAResultSchema>;
