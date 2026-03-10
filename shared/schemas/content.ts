import { z } from 'zod/v4';

export const ScriptSectionSchema = z.object({
  type: z.enum(['hook', 'intro', 'body', 'examples', 'cta', 'outro']),
  content: z.string(),
  durationSeconds: z.number(),
});

export type ScriptSection = z.infer<typeof ScriptSectionSchema>;

export const ContentBundleSchema = z.object({
  topicId: z.string(),
  title: z.string().max(100),
  description: z.string(),
  tags: z.array(z.string()),
  sections: z.array(ScriptSectionSchema),
  narrationPath: z.string(),
  videoPath: z.string(),
  totalDurationSeconds: z.number(),
  claudeTokensUsed: z.number(),
  producedAt: z.string(),
});

export type ContentBundle = z.infer<typeof ContentBundleSchema>;
