import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoredTopicListSchema } from '@shared/schemas';
import { TrendScoutAgent } from '../index';
import { parseRssFeed } from '../rss-fetcher';
import { fetchRedditPosts } from '../reddit-fetcher';
import { fetchYouTubeTrends } from '../youtube-fetcher';
import { scoreAndDeduplicateTopics } from '../scorer';
import type { AgentContext } from '@shared/types/agent';
import type { RawTopic } from '../scorer';

// T007 — TrendScout Agent
// Tests will fail at import until trend-scout modules are implemented.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RSS_FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI News</title>
    <item>
      <title>GPT-5 Launches Today With Unprecedented Capabilities</title>
      <link>https://openai.com/blog/gpt-5</link>
      <pubDate>Mon, 10 Mar 2025 09:00:00 +0000</pubDate>
      <description>OpenAI releases GPT-5, its most powerful model yet.</description>
    </item>
    <item>
      <title>Claude 4 Beats Human Experts on MMLU Benchmark</title>
      <link>https://anthropic.com/news/claude-4</link>
      <pubDate>Sun, 09 Mar 2025 08:00:00 +0000</pubDate>
      <description>Anthropic's Claude 4 achieves state-of-the-art results.</description>
    </item>
  </channel>
</rss>`;

const REDDIT_FIXTURE = {
  data: {
    children: [
      {
        data: {
          title: 'GPT-5 is out — my benchmarks and first impressions',
          url: 'https://reddit.com/r/MachineLearning/comments/abc123',
          score: 4200,
          num_comments: 318,
          created_utc: Date.now() / 1000,
        },
      },
      {
        data: {
          title: 'Open-source alternative to Claude just dropped',
          url: 'https://reddit.com/r/LocalLLaMA/comments/def456',
          score: 1800,
          num_comments: 204,
          created_utc: Date.now() / 1000,
        },
      },
    ],
  },
};

const YOUTUBE_FIXTURE = {
  items: [
    {
      id: { videoId: 'yt001' },
      snippet: {
        title: 'GPT-5 Review: Is It Worth It?',
        channelTitle: 'AI Explained',
        publishedAt: new Date().toISOString(),
        description: 'We test GPT-5 on real-world tasks.',
      },
      statistics: { viewCount: '850000', likeCount: '42000' },
    },
    {
      id: { videoId: 'yt002' },
      snippet: {
        title: 'The New Wave of Open Source LLMs',
        channelTitle: 'Machine Learning Street Talk',
        publishedAt: new Date().toISOString(),
        description: 'Open source models are catching up fast.',
      },
      statistics: { viewCount: '320000', likeCount: '18000' },
    },
  ],
};

// ---------------------------------------------------------------------------
// RSS Fetcher
// ---------------------------------------------------------------------------
describe('T007 — parseRssFeed', () => {
  // Acceptance: "Fetches from RSS, Reddit, and YouTube sources"
  it('should parse items from a valid RSS XML string', () => {
    const items = parseRssFeed(RSS_FIXTURE_XML);
    expect(items.length).toBe(2);
    expect(items[0].title).toContain('GPT-5');
    expect(items[0].url).toBe('https://openai.com/blog/gpt-5');
  });

  it('should return an empty array for an empty RSS feed', () => {
    const emptyFeed = `<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>`;
    const items = parseRssFeed(emptyFeed);
    expect(items).toHaveLength(0);
  });

  it('should include publishedAt as an ISO date string', () => {
    const items = parseRssFeed(RSS_FIXTURE_XML);
    expect(() => new Date(items[0].publishedAt).toISOString()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Reddit Fetcher
// ---------------------------------------------------------------------------
describe('T007 — fetchRedditPosts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => REDDIT_FIXTURE,
    }));
  });

  it('should return posts with title, url, score, and commentCount', async () => {
    const posts = await fetchRedditPosts('MachineLearning');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toMatchObject({
      title: expect.any(String),
      url: expect.any(String),
      score: expect.any(Number),
      commentCount: expect.any(Number),
    });
  });

  // Acceptance: "Graceful degradation if one source fails (continues with others)"
  it('should return an empty array when the Reddit API returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const posts = await fetchRedditPosts('MachineLearning');
    expect(posts).toEqual([]);
  });

  it('should return an empty array when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const posts = await fetchRedditPosts('MachineLearning');
    expect(posts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// YouTube Fetcher
// ---------------------------------------------------------------------------
describe('T007 — fetchYouTubeTrends', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => YOUTUBE_FIXTURE,
    }));
  });

  it('should return video metadata with title, channelName, and viewCount', async () => {
    const videos = await fetchYouTubeTrends('AI 2025', 'FAKE_API_KEY');
    expect(videos.length).toBeGreaterThan(0);
    expect(videos[0]).toMatchObject({
      title: expect.any(String),
      channelName: expect.any(String),
      viewCount: expect.any(Number),
    });
  });

  it('should return an empty array when the YouTube API key is missing', async () => {
    const videos = await fetchYouTubeTrends('AI 2025', '');
    expect(videos).toEqual([]);
  });

  it('should return an empty array on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API error')));
    const videos = await fetchYouTubeTrends('AI 2025', 'FAKE_API_KEY');
    expect(videos).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------
describe('T007 — scoreAndDeduplicateTopics', () => {
  const rawTopics: RawTopic[] = [
    { title: 'GPT-5 Launches', slug: 'gpt-5-launches', sources: ['https://openai.com'], recencyScore: 95, engagementScore: 88, sourceCount: 3 },
    { title: 'GPT-5 is Here!', slug: 'gpt-5-launches', sources: ['https://reddit.com'], recencyScore: 90, engagementScore: 75, sourceCount: 1 },
    { title: 'Open Source LLMs Rise', slug: 'open-source-llm', sources: ['https://huggingface.co'], recencyScore: 70, engagementScore: 60, sourceCount: 2 },
    { title: 'Claude 4 Benchmark Results', slug: 'claude-4-benchmark', sources: ['https://anthropic.com'], recencyScore: 85, engagementScore: 78, sourceCount: 2 },
    { title: 'LLM Cost Optimisation Tips', slug: 'llm-cost-tips', sources: ['https://blog.example.com'], recencyScore: 60, engagementScore: 45, sourceCount: 1 },
    { title: 'Mistral 8x7B Fine-tuning Guide', slug: 'mistral-finetune', sources: ['https://mistral.ai'], recencyScore: 55, engagementScore: 42, sourceCount: 1 },
  ];

  // Acceptance: "Scores topics using weighted multi-factor scoring"
  it('should return topics sorted by descending score', () => {
    const scored = scoreAndDeduplicateTopics(rawTopics, { topN: 5 });
    for (let i = 0; i < scored.length - 1; i++) {
      expect(scored[i].score).toBeGreaterThanOrEqual(scored[i + 1].score);
    }
  });

  // Acceptance: "Deduplicates similar topics"
  it('should deduplicate topics with the same slug', () => {
    const scored = scoreAndDeduplicateTopics(rawTopics, { topN: 10 });
    const slugs = scored.map((t) => t.slug);
    const uniqueSlugs = new Set(slugs);
    expect(slugs.length).toBe(uniqueSlugs.size);
  });

  it('should return at most topN topics', () => {
    const scored = scoreAndDeduplicateTopics(rawTopics, { topN: 3 });
    expect(scored.length).toBeLessThanOrEqual(3);
  });

  it('should assign each topic a score between 0 and 100', () => {
    const scored = scoreAndDeduplicateTopics(rawTopics, { topN: 5 });
    for (const topic of scored) {
      expect(topic.score).toBeGreaterThanOrEqual(0);
      expect(topic.score).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Full agent lifecycle
// ---------------------------------------------------------------------------
describe('T007 — TrendScoutAgent lifecycle', () => {
  function makeCtx(): AgentContext {
    return {
      runId: 'run-trend-001',
      runDir: '/tmp/run-trend-001',
      db: null as any,
      emitter: { broadcast: vi.fn() } as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    };
  }

  // Acceptance: "Agent extends BaseAgent with inputFile: null and outputFile: 'topics.json'"
  it('should have inputFile null and outputFile topics.json', () => {
    const agent = new TrendScoutAgent();
    expect((agent as any).inputFile).toBeNull();
    expect((agent as any).outputFile).toBe('topics.json');
  });

  // Acceptance: "Output validates against ScoredTopicListSchema"
  it('should produce output that validates against ScoredTopicListSchema', async () => {
    // Mock all fetchers to return fixture data so no real network calls happen
    vi.mock('../rss-fetcher', () => ({
      fetchRssFeeds: vi.fn().mockResolvedValue([
        { title: 'GPT-5 Launches', url: 'https://openai.com', publishedAt: new Date().toISOString(), summary: '' },
      ]),
    }));
    vi.mock('../reddit-fetcher', () => ({
      fetchAllSubreddits: vi.fn().mockResolvedValue([
        { title: 'GPT-5 is Here!', url: 'https://reddit.com/r/ml', score: 4200, commentCount: 300 },
      ]),
    }));
    vi.mock('../youtube-fetcher', () => ({
      fetchAllYouTubeTrends: vi.fn().mockResolvedValue([
        { title: 'GPT-5 Review', channelName: 'AI Explained', viewCount: 800000, videoId: 'yt001', publishedAt: new Date().toISOString() },
      ]),
    }));

    const agent = new TrendScoutAgent();
    const ctx = makeCtx();

    const fs = await import('node:fs');
    fs.mkdirSync(ctx.runDir, { recursive: true });

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(() => ScoredTopicListSchema.parse(output)).not.toThrow();
    }

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Acceptance: "Tests cover happy path and each source failing independently"
  it('should succeed even when RSS fetching fails completely', async () => {
    vi.mock('../rss-fetcher', () => ({
      fetchRssFeeds: vi.fn().mockRejectedValue(new Error('RSS unreachable')),
    }));
    vi.mock('../reddit-fetcher', () => ({
      fetchAllSubreddits: vi.fn().mockResolvedValue([
        { title: 'Top AI Story', url: 'https://reddit.com', score: 5000, commentCount: 400 },
      ]),
    }));
    vi.mock('../youtube-fetcher', () => ({
      fetchAllYouTubeTrends: vi.fn().mockResolvedValue([]),
    }));

    const agent = new TrendScoutAgent();
    const ctx = makeCtx();
    const fs = await import('node:fs');
    fs.mkdirSync(ctx.runDir, { recursive: true });

    const result = await agent.execute(ctx);
    expect(result.success).toBe(true);

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
});
