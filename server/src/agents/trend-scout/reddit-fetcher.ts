import type { Logger } from 'pino';
import { SUBREDDITS, REDDIT_USER_AGENT } from './config.js';

export interface RedditPost {
  readonly title: string;
  readonly url: string;
  readonly score: number;
  readonly commentCount: number;
}

/**
 * Fetch hot posts from a single subreddit using the public JSON API.
 * Returns an empty array on failure (graceful degradation).
 */
export async function fetchRedditPosts(subreddit: string, logger?: Logger): Promise<readonly RedditPost[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: { 'User-Agent': REDDIT_USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      logger?.warn({ subreddit, status: response.status }, 'Reddit API returned non-OK status');
      return [];
    }

    const json = await response.json() as {
      data: {
        children: Array<{
          data: {
            title: string;
            url: string;
            score: number;
            num_comments: number;
            created_utc: number;
          };
        }>;
      };
    };

    const posts: RedditPost[] = json.data.children.map((child) => ({
      title: child.data.title,
      url: child.data.url,
      score: child.data.score,
      commentCount: child.data.num_comments,
    }));

    return posts;
  } catch (err) {
    logger?.warn({ subreddit, err }, 'Reddit fetch failed');
    return [];
  }
}

/**
 * Fetch posts from all configured subreddits in parallel.
 * Gracefully degrades: failed subreddits are logged and skipped.
 */
export async function fetchAllSubreddits(logger?: Logger): Promise<readonly RedditPost[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map((sub) => fetchRedditPosts(sub, logger)),
  );

  const posts: RedditPost[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      posts.push(...result.value);
    }
  }

  return posts;
}
