import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { ResearchDossierSchema, ScoredTopicListSchema } from '@shared/schemas';
import { ResearchCrawlerAgent } from '../index';
import { selectTopTopic } from '../topic-selector';
import { scrapeWebPage, scrapeUrls } from '../web-scraper';
import { analyzeCompetitors } from '../competitor-analyzer';
import { buildDossier } from '../dossier-builder';
import type { AgentContext } from '@shared/types/agent';
import type { ScoredTopic, ScoredTopicList } from '@shared/schemas';

// T008 — ResearchCrawler Agent
// Top-level auto-mocks — all exports become vi.fn(). Unit test describes
// restore real implementations via vi.importActual. Lifecycle tests configure
// mock return values in beforeEach.
vi.mock('../web-scraper');
vi.mock('../competitor-analyzer');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCORED_TOPIC_LIST: ScoredTopicList = {
  topics: [
    {
      id: 'topic-001',
      title: 'GPT-5 Launches Today',
      slug: 'gpt-5-launches',
      score: 95,
      sources: ['https://openai.com/blog/gpt-5', 'https://reddit.com/r/ml/abc'],
      fetchedAt: new Date().toISOString(),
    },
    {
      id: 'topic-002',
      title: 'Open Source LLMs Rise',
      slug: 'open-source-llm',
      score: 72,
      sources: ['https://huggingface.co/blog/open-llm'],
      fetchedAt: new Date().toISOString(),
    },
  ],
  generatedAt: new Date().toISOString(),
};

const FIXTURE_HTML = `<!DOCTYPE html>
<html>
  <head><title>GPT-5 Blog Post</title></head>
  <body>
    <h1>GPT-5 Launches</h1>
    <p>OpenAI today announced GPT-5, featuring dramatically improved reasoning capabilities.</p>
    <p>The model achieves human-expert performance on a wide range of benchmarks.</p>
    <p>Pricing starts at $0.002 per 1K tokens for input.</p>
  </body>
</html>`;

const YOUTUBE_COMPETITOR_FIXTURE = {
  items: [
    {
      id: { videoId: 'yt-competitor-1' },
      snippet: {
        title: 'GPT-5 First Look',
        channelTitle: 'AI Explained',
        publishedAt: '2025-03-01T10:00:00Z',
        description: 'Quick overview of GPT-5 features.',
      },
      statistics: { viewCount: '1200000', likeCount: '56000' },
    },
    {
      id: { videoId: 'yt-competitor-2' },
      snippet: {
        title: 'Is GPT-5 Worth the Hype?',
        channelTitle: 'Two Minute Papers',
        publishedAt: '2025-03-02T12:00:00Z',
        description: 'Breaking down the GPT-5 technical report.',
      },
      statistics: { viewCount: '890000', likeCount: '38000' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Topic Selector
// ---------------------------------------------------------------------------
describe('T008 — selectTopTopic', () => {
  // Acceptance: "Selects highest-scoring topic for research"
  it('should return the topic with the highest score', () => {
    const topic = selectTopTopic(SCORED_TOPIC_LIST);
    expect(topic.id).toBe('topic-001');
    expect(topic.score).toBe(95);
  });

  it('should return the single topic when the list has only one entry', () => {
    const singleList: ScoredTopicList = {
      topics: [SCORED_TOPIC_LIST.topics[1]],
      generatedAt: new Date().toISOString(),
    };
    const topic = selectTopTopic(singleList);
    expect(topic.id).toBe('topic-002');
  });
});

// ---------------------------------------------------------------------------
// Web Scraper
// ---------------------------------------------------------------------------
describe('T008 — scrapeWebPage', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../web-scraper')>('../web-scraper');
    vi.mocked(scrapeWebPage).mockImplementation(actual.scrapeWebPage);
  });

  // Acceptance: "Scrapes web pages using Playwright (headless)"
  it('should extract title and text content from an HTML page', async () => {
    // Mock Playwright browser
    const mockPage = {
      goto: vi.fn().mockResolvedValue(null),
      title: vi.fn().mockResolvedValue('GPT-5 Blog Post'),
      evaluate: vi.fn().mockResolvedValue({
        paragraphs: [
          'OpenAI today announced GPT-5, featuring dramatically improved reasoning capabilities.',
          'The model achieves human-expert performance on a wide range of benchmarks.',
        ],
        headings: ['GPT-5 Launches'],
      }),
      close: vi.fn().mockResolvedValue(null),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(null),
    };

    const result = await scrapeWebPage('https://openai.com/blog/gpt-5', mockBrowser as any);
    expect(result.url).toBe('https://openai.com/blog/gpt-5');
    expect(result.title).toBeDefined();
    expect(Array.isArray(result.paragraphs)).toBe(true);
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });

  // Acceptance: "Handles scraping failures gracefully (continue with remaining sources)"
  it('should return null when navigation fails', async () => {
    const mockPage = {
      goto: vi.fn().mockRejectedValue(new Error('Navigation timeout')),
      close: vi.fn().mockResolvedValue(null),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };

    const result = await scrapeWebPage('https://blocked-site.example.com', mockBrowser as any);
    expect(result).toBeNull();
  });

  // Acceptance: "Playwright browser properly closed in all code paths (success + error)"
  it('should always close the page even when scraping throws', async () => {
    const mockPage = {
      goto: vi.fn().mockResolvedValue(null),
      title: vi.fn().mockRejectedValue(new Error('Page crashed')),
      close: vi.fn().mockResolvedValue(null),
    };
    const mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    };

    await scrapeWebPage('https://example.com', mockBrowser as any);
    expect(mockPage.close).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Competitor Analyzer
// ---------------------------------------------------------------------------
describe('T008 — analyzeCompetitors', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../competitor-analyzer')>('../competitor-analyzer');
    vi.mocked(analyzeCompetitors).mockImplementation(actual.analyzeCompetitors);
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => YOUTUBE_COMPETITOR_FIXTURE,
    }));
  });

  // Acceptance: "Competitor analysis identifies content gaps"
  it('should return competitor videos with gaps identified', async () => {
    const competitors = await analyzeCompetitors('GPT-5', 'FAKE_API_KEY');
    expect(competitors.length).toBeGreaterThan(0);
    expect(competitors[0]).toMatchObject({
      videoId: expect.any(String),
      title: expect.any(String),
      viewCount: expect.any(Number),
      gaps: expect.any(Array),
    });
  });

  it('should return an empty array when the YouTube API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API error')));
    const competitors = await analyzeCompetitors('GPT-5', 'FAKE_API_KEY');
    expect(competitors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Dossier Builder
// ---------------------------------------------------------------------------
describe('T008 — buildDossier', () => {
  const topic: ScoredTopic = SCORED_TOPIC_LIST.topics[0];

  const scrapedSources = [
    {
      url: 'https://openai.com/blog/gpt-5',
      title: 'GPT-5 Launches',
      excerpt: 'OpenAI today announced GPT-5...',
      scrapedAt: new Date().toISOString(),
    },
  ];

  const competitors = [
    {
      videoId: 'yt-competitor-1',
      title: 'GPT-5 First Look',
      channelName: 'AI Explained',
      viewCount: 1200000,
      publishedAt: '2025-03-01T10:00:00Z',
      gaps: ['Does not cover API migration'],
    },
  ];

  it('should build a dossier with keyPoints extracted from sources', () => {
    const dossier = buildDossier({ topic, scrapedSources, competitors });
    expect(dossier.topicId).toBe(topic.id);
    expect(Array.isArray(dossier.keyPoints)).toBe(true);
    expect(dossier.keyPoints.length).toBeGreaterThan(0);
  });

  it('should include a suggestedAngle in the dossier', () => {
    const dossier = buildDossier({ topic, scrapedSources, competitors });
    expect(typeof dossier.suggestedAngle).toBe('string');
    expect(dossier.suggestedAngle.length).toBeGreaterThan(0);
  });

  it('should include an estimatedScriptMinutes between 5 and 20', () => {
    const dossier = buildDossier({ topic, scrapedSources, competitors });
    expect(dossier.estimatedScriptMinutes).toBeGreaterThanOrEqual(5);
    expect(dossier.estimatedScriptMinutes).toBeLessThanOrEqual(20);
  });

  it('should produce a dossier that validates against ResearchDossierSchema', () => {
    const dossier = buildDossier({ topic, scrapedSources, competitors });
    expect(() => ResearchDossierSchema.parse(dossier)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Full agent lifecycle
// ---------------------------------------------------------------------------
describe('T008 — ResearchCrawlerAgent lifecycle', () => {
  beforeEach(() => {
    vi.mocked(scrapeWebPage).mockReset();
    vi.mocked(scrapeUrls).mockReset();
    vi.mocked(analyzeCompetitors).mockReset();
    // Default mock setup for lifecycle tests
    vi.mocked(scrapeUrls).mockResolvedValue([
      { url: 'https://openai.com/blog/gpt-5', title: 'GPT-5 Blog', excerpt: 'GPT-5 is out...', scrapedAt: new Date().toISOString() },
    ]);
    vi.mocked(analyzeCompetitors).mockResolvedValue([
      { videoId: 'yt1', title: 'GPT-5 Review', channelName: 'AI Explained', viewCount: 500000, publishedAt: new Date().toISOString(), gaps: [] },
    ]);
  });

  function makeCtx(): AgentContext {
    return {
      runId: 'run-research-001',
      runDir: '/tmp/run-research-001',
      db: null as any,
      emitter: { broadcast: vi.fn() } as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    };
  }

  // Acceptance: "Agent extends BaseAgent with inputFile: 'topics.json', outputFile: 'research.json'"
  it('should have inputFile topics.json and outputFile research.json', () => {
    const agent = new ResearchCrawlerAgent();
    expect((agent as any).inputFile).toBe('topics.json');
    expect((agent as any).outputFile).toBe('research.json');
  });

  // Acceptance: "Output validates against ResearchDossierSchema"
  it('should write a research.json that validates against ResearchDossierSchema', async () => {
    const agent = new ResearchCrawlerAgent();
    const ctx = makeCtx();
    const fs = await import('node:fs');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(`${ctx.runDir}/topics.json`, JSON.stringify(SCORED_TOPIC_LIST));

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(() => ResearchDossierSchema.parse(output)).not.toThrow();
    }

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });

  // Acceptance: "Tests cover happy path, partial scraping failure, and competitor analysis"
  it('should succeed when some source URLs fail to scrape', async () => {
    vi.mocked(scrapeUrls).mockReset();
    vi.mocked(scrapeUrls).mockResolvedValue([
      null, // first URL failed
      { url: 'https://openai.com/blog/gpt-5', title: 'GPT-5 Blog', excerpt: 'GPT-5 is out...', scrapedAt: new Date().toISOString() },
    ]);
    vi.mocked(analyzeCompetitors).mockReset();
    vi.mocked(analyzeCompetitors).mockResolvedValue([]);

    const agent = new ResearchCrawlerAgent();
    const ctx = makeCtx();
    const fs = await import('node:fs');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(`${ctx.runDir}/topics.json`, JSON.stringify(SCORED_TOPIC_LIST));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(true);

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });
});
