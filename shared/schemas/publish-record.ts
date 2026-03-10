import { z } from 'zod/v4';

export const PublishRecordSchema = z.object({
  topicId: z.string(),
  runId: z.string(),
  status: z.enum(['published', 'scheduled', 'skipped', 'failed']),
  youtubeVideoId: z.string().optional(),
  youtubeUrl: z.string().optional(),
  skipReason: z.string().optional(),
  title: z.string(),
  publishedAt: z.string(),
});

export type PublishRecord = z.infer<typeof PublishRecordSchema>;
