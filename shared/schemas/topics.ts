import { z } from 'zod/v4';

export const ScoredTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  score: z.number().min(0).max(100),
  sources: z.array(z.string()),
  fetchedAt: z.string(),
});

export type ScoredTopic = z.infer<typeof ScoredTopicSchema>;

export const ScoredTopicListSchema = z.object({
  topics: z.array(ScoredTopicSchema).min(1),
  generatedAt: z.string(),
});

export type ScoredTopicList = z.infer<typeof ScoredTopicListSchema>;
