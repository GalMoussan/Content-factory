import { z } from 'zod/v4';
import { ScoredTopicListSchema } from '@shared/schemas';
import type { ScoredTopicList } from '@shared/schemas';
import type { AgentContext } from '@shared/types/agent';
import { BaseAgent } from '../base-agent.js';
import { fetchRssFeeds } from './rss-fetcher.js';
import { fetchAllSubreddits } from './reddit-fetcher.js';
import { fetchAllYouTubeTrends } from './youtube-fetcher.js';
import { scoreAndDeduplicateTopics } from './scorer.js';
import type { RawTopic } from './scorer.js';

/**
 * TrendScout Agent — first agent in the pipeline.
 * Fetches trending topics from RSS, Reddit, and YouTube,
 * then scores, deduplicates, and outputs a ranked topic list.
 */
export class TrendScoutAgent extends BaseAgent<null, ScoredTopicList> {
  public readonly inputSchema = z.null();
  public readonly outputSchema = ScoredTopicListSchema;

  constructor() {
    super({
      name: 'trend-scout',
      inputFile: null,
      outputFile: 'topics.json',
    });
  }

  protected async process(_input: null, ctx: AgentContext): Promise<ScoredTopicList> {
    ctx.logger.info('TrendScout: fetching from all sources...');

    // Fetch from all sources in parallel with graceful degradation
    const [rssResult, redditResult, youtubeResult] = await Promise.allSettled([
      fetchRssFeeds(),
      fetchAllSubreddits(),
      fetchAllYouTubeTrends(),
    ]);

    const rssItems =
      rssResult.status === 'fulfilled' ? rssResult.value : [];
    const redditPosts =
      redditResult.status === 'fulfilled' ? redditResult.value : [];
    const youtubeVideos =
      youtubeResult.status === 'fulfilled' ? youtubeResult.value : [];

    if (rssResult.status === 'rejected') {
      ctx.logger.warn('TrendScout: RSS fetch failed, continuing with other sources');
    }
    if (redditResult.status === 'rejected') {
      ctx.logger.warn('TrendScout: Reddit fetch failed, continuing with other sources');
    }
    if (youtubeResult.status === 'rejected') {
      ctx.logger.warn('TrendScout: YouTube fetch failed, continuing with other sources');
    }

    // Convert all results to RawTopic format
    const rawTopics: RawTopic[] = [];

    for (const item of rssItems) {
      rawTopics.push({
        title: item.title,
        slug: slugify(item.title),
        sources: [item.url],
        recencyScore: computeRecencyScore(item.publishedAt),
        engagementScore: 50, // RSS has no engagement metrics
        sourceCount: 1,
      });
    }

    for (const post of redditPosts) {
      rawTopics.push({
        title: post.title,
        slug: slugify(post.title),
        sources: [post.url],
        recencyScore: 80, // Reddit hot posts are recent by definition
        engagementScore: Math.min(100, Math.round((post.score / 100) + (post.commentCount / 10))),
        sourceCount: 1,
      });
    }

    for (const video of youtubeVideos) {
      rawTopics.push({
        title: video.title,
        slug: slugify(video.title),
        sources: [`https://youtube.com/watch?v=${video.videoId}`],
        recencyScore: computeRecencyScore(video.publishedAt),
        engagementScore: Math.min(100, Math.round(video.viewCount / 10_000)),
        sourceCount: 1,
      });
    }

    ctx.logger.info(`TrendScout: collected ${rawTopics.length} raw topics`);

    // Score, deduplicate, and rank
    const scoredTopics = scoreAndDeduplicateTopics(rawTopics, { topN: 10 });

    ctx.logger.info(`TrendScout: returning ${scoredTopics.length} scored topics`);

    return {
      topics: [...scoredTopics],
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Convert a title string to a URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Compute a recency score (0-100) based on how recent the publishedAt date is.
 * Items from today score ~100, items older than 7 days score ~0.
 */
function computeRecencyScore(publishedAt: string): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const score = Math.max(0, Math.min(100, Math.round(100 - (ageDays * 14))));
  return score;
}
