// TrendScout configuration constants

export const RSS_FEEDS = [
  'https://dev.to/feed',
  'https://css-tricks.com/feed/',
  'https://blog.codepen.io/feed/',
] as const;

export const SUBREDDITS = [
  'webdev',
  'programming',
  'reactjs',
] as const;

export const YOUTUBE_QUERIES = [
  'developer productivity hacks',
  'coding tips and tricks 2026',
  'web development shortcuts',
] as const;

export const SCORING_WEIGHTS = {
  recency: 0.4,
  engagement: 0.35,
  sourceCount: 0.25,
} as const;

export const DEFAULT_TOP_N = 10;

export const REDDIT_USER_AGENT = 'ContentFactory/1.0 (TrendScout Agent)';
