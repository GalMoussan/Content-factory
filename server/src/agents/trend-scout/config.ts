// TrendScout configuration constants

export const RSS_FEEDS = [
  'https://feeds.feedburner.com/oreilly/radar',
  'https://blog.google/technology/ai/rss/',
  'https://openai.com/blog/rss/',
] as const;

export const SUBREDDITS = [
  'MachineLearning',
  'artificial',
  'LocalLLaMA',
] as const;

export const YOUTUBE_QUERIES = [
  'AI news this week',
  'machine learning tutorial',
  'large language models',
] as const;

export const SCORING_WEIGHTS = {
  recency: 0.4,
  engagement: 0.35,
  sourceCount: 0.25,
} as const;

export const DEFAULT_TOP_N = 10;

export const REDDIT_USER_AGENT = 'ContentFactory/1.0 (TrendScout Agent)';
