import { z } from 'zod/v4';

const RssSourceSchema = z.object({
  type: z.literal('rss'),
  url: z.url(),
  label: z.string(),
});

const RedditSourceSchema = z.object({
  type: z.literal('reddit'),
  subreddit: z.string(),
  label: z.string(),
});

const YoutubeSourceSchema = z.object({
  type: z.literal('youtube'),
  channelId: z.string(),
  label: z.string(),
});

export const SourceSchema = z.discriminatedUnion('type', [
  RssSourceSchema,
  RedditSourceSchema,
  YoutubeSourceSchema,
]);

export type Source = z.infer<typeof SourceSchema>;
