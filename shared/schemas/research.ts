import { z } from 'zod/v4';

export const ResearchSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  excerpt: z.string(),
  scrapedAt: z.string(),
});

export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const CompetitorVideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channelName: z.string(),
  viewCount: z.number(),
  publishedAt: z.string(),
  gaps: z.array(z.string()),
});

export type CompetitorVideo = z.infer<typeof CompetitorVideoSchema>;

export const TopicResearchSchema = z.object({
  topicId: z.string(),
  keyPoints: z.array(z.string()).min(1),
  sources: z.array(ResearchSourceSchema),
  competitors: z.array(CompetitorVideoSchema),
});

export type TopicResearch = z.infer<typeof TopicResearchSchema>;

export const ResearchDossierSchema = z.object({
  topicId: z.string(),
  topicTitle: z.string(),
  keyPoints: z.array(z.string()).min(1),
  sources: z.array(ResearchSourceSchema),
  competitors: z.array(CompetitorVideoSchema),
  suggestedAngle: z.string(),
  estimatedScriptMinutes: z.number(),
  researchedAt: z.string(),
});

export type ResearchDossier = z.infer<typeof ResearchDossierSchema>;
