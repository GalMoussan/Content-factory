import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  SourceSchema,
  ScoredTopicSchema,
  ScoredTopicListSchema,
  ResearchSourceSchema,
  CompetitorVideoSchema,
  TopicResearchSchema,
  ResearchDossierSchema,
  ScriptSectionSchema,
  ContentBundleSchema,
  QADimensionSchema,
  QAResultSchema,
  PublishRecordSchema,
  AgentErrorSchema,
  SSEEventSchema,
  ApiSuccessSchema,
  ApiErrorSchema,
  PaginatedSchema,
  RunMetaSchema,
} from '../index';
import type {
  Source,
  ScoredTopic,
  ScoredTopicList,
  ResearchDossier,
  ContentBundle,
  QAResult,
  PublishRecord,
  AgentError,
  RunMeta,
} from '../index';

// T002 — Shared Types and Zod Schemas
// Tests will fail at import until schema files are implemented.

// ---------------------------------------------------------------------------
// SourceSchema
// ---------------------------------------------------------------------------
describe('T002 — SourceSchema', () => {
  // Acceptance: "All schemas from system design Section 4 are implemented"
  it('should parse a valid RSS source', () => {
    const valid: Source = {
      type: 'rss',
      url: 'https://feeds.example.com/ai.xml',
      label: 'AI Blog',
    };
    expect(() => SourceSchema.parse(valid)).not.toThrow();
  });

  it('should parse a valid Reddit source', () => {
    const valid: Source = {
      type: 'reddit',
      subreddit: 'MachineLearning',
      label: 'r/ML',
    };
    expect(() => SourceSchema.parse(valid)).not.toThrow();
  });

  it('should parse a valid YouTube source', () => {
    const valid: Source = {
      type: 'youtube',
      channelId: 'UCxxxxxx',
      label: 'AI Channel',
    };
    expect(() => SourceSchema.parse(valid)).not.toThrow();
  });

  // Acceptance: "Schema tests cover valid data parsing and invalid data rejection"
  it('should reject a source with an unknown type', () => {
    const invalid = { type: 'twitter', url: 'https://x.com' };
    expect(() => SourceSchema.parse(invalid)).toThrow(ZodError);
  });

  it('should reject a source missing required fields', () => {
    expect(() => SourceSchema.parse({})).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// ScoredTopicSchema / ScoredTopicListSchema
// ---------------------------------------------------------------------------
describe('T002 — ScoredTopicSchema', () => {
  const validTopic: ScoredTopic = {
    id: 'topic-abc123',
    title: 'GPT-5 Announced: What You Need to Know',
    slug: 'gpt-5-announced',
    score: 87.5,
    sources: ['https://openai.com/blog/gpt-5', 'https://reddit.com/r/ml/...'],
    fetchedAt: new Date().toISOString(),
  };

  // Acceptance: "Each schema exports both the Zod object and z.infer type"
  it('should parse a valid scored topic', () => {
    expect(() => ScoredTopicSchema.parse(validTopic)).not.toThrow();
  });

  it('should reject a topic with a score outside 0-100', () => {
    expect(() => ScoredTopicSchema.parse({ ...validTopic, score: 150 })).toThrow(ZodError);
    expect(() => ScoredTopicSchema.parse({ ...validTopic, score: -1 })).toThrow(ZodError);
  });

  it('should reject a topic missing the title', () => {
    const { title: _omitted, ...rest } = validTopic;
    expect(() => ScoredTopicSchema.parse(rest)).toThrow(ZodError);
  });

  it('should parse a valid ScoredTopicList (array with at least 1 topic)', () => {
    const list: ScoredTopicList = { topics: [validTopic], generatedAt: new Date().toISOString() };
    expect(() => ScoredTopicListSchema.parse(list)).not.toThrow();
  });

  it('should reject a ScoredTopicList with an empty topics array', () => {
    expect(() => ScoredTopicListSchema.parse({ topics: [], generatedAt: new Date().toISOString() })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// ResearchDossierSchema
// ---------------------------------------------------------------------------
describe('T002 — ResearchDossierSchema', () => {
  const validDossier: ResearchDossier = {
    topicId: 'topic-abc123',
    topicTitle: 'GPT-5 Announced: What You Need to Know',
    keyPoints: ['Faster inference', 'Multimodal by default', 'Available via API'],
    sources: [
      {
        url: 'https://openai.com/blog/gpt-5',
        title: 'OpenAI Blog',
        excerpt: 'GPT-5 launches today...',
        scrapedAt: new Date().toISOString(),
      },
    ],
    competitors: [
      {
        videoId: 'yt-xyz',
        title: 'GPT-5 Review',
        channelName: 'AI Explained',
        viewCount: 250000,
        publishedAt: new Date().toISOString(),
        gaps: ['Did not cover API pricing'],
      },
    ],
    suggestedAngle: 'Focus on developer migration path from GPT-4',
    estimatedScriptMinutes: 8,
    researchedAt: new Date().toISOString(),
  };

  it('should parse a valid research dossier', () => {
    expect(() => ResearchDossierSchema.parse(validDossier)).not.toThrow();
  });

  it('should reject a dossier with an empty keyPoints array', () => {
    expect(() => ResearchDossierSchema.parse({ ...validDossier, keyPoints: [] })).toThrow(ZodError);
  });

  it('should reject a dossier missing the suggestedAngle', () => {
    const { suggestedAngle: _omitted, ...rest } = validDossier;
    expect(() => ResearchDossierSchema.parse(rest)).toThrow(ZodError);
  });

  it('should accept a valid ResearchSourceSchema entry', () => {
    expect(() => ResearchSourceSchema.parse(validDossier.sources[0])).not.toThrow();
  });

  it('should accept a valid CompetitorVideoSchema entry', () => {
    expect(() => CompetitorVideoSchema.parse(validDossier.competitors[0])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ContentBundleSchema
// ---------------------------------------------------------------------------
describe('T002 — ContentBundleSchema', () => {
  const validBundle: ContentBundle = {
    topicId: 'topic-abc123',
    title: 'GPT-5: The Complete Developer Guide',
    description: 'Everything you need to know about GPT-5 as a developer.',
    tags: ['AI', 'GPT-5', 'OpenAI', 'LLM'],
    sections: [
      { type: 'hook', content: 'What if I told you GPT-5 changes everything?', durationSeconds: 15 },
      { type: 'intro', content: 'Welcome to this deep dive into GPT-5.', durationSeconds: 30 },
      { type: 'body', content: 'GPT-5 brings massive improvements in reasoning.', durationSeconds: 120 },
      { type: 'cta', content: 'Like and subscribe for more.', durationSeconds: 20 },
      { type: 'outro', content: 'See you next time!', durationSeconds: 10 },
    ],
    narrationPath: 'assets/narration.mp3',
    videoPath: 'assets/video.mp4',
    totalDurationSeconds: 195,
    claudeTokensUsed: 4200,
    producedAt: new Date().toISOString(),
  };

  it('should parse a valid content bundle', () => {
    expect(() => ContentBundleSchema.parse(validBundle)).not.toThrow();
  });

  it('should reject a bundle with a title exceeding 100 characters', () => {
    const longTitle = 'A'.repeat(101);
    expect(() => ContentBundleSchema.parse({ ...validBundle, title: longTitle })).toThrow(ZodError);
  });

  it('should reject a bundle missing required narrationPath', () => {
    const { narrationPath: _omitted, ...rest } = validBundle;
    expect(() => ContentBundleSchema.parse(rest)).toThrow(ZodError);
  });

  it('should validate each ScriptSection type', () => {
    for (const section of validBundle.sections) {
      expect(() => ScriptSectionSchema.parse(section)).not.toThrow();
    }
  });

  it('should reject a section with an invalid type', () => {
    expect(() => ScriptSectionSchema.parse({ type: 'advertisement', content: 'Buy now', durationSeconds: 5 })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// QAResultSchema
// ---------------------------------------------------------------------------
describe('T002 — QAResultSchema', () => {
  const makeQADimension = (name: string) => ({
    dimension: name,
    score: 80,
    feedback: 'Good quality.',
    issues: [],
  });

  const validQAResult: QAResult = {
    topicId: 'topic-abc123',
    overallScore: 82,
    verdict: 'approved',
    dimensions: [
      makeQADimension('script-quality'),
      makeQADimension('factual-accuracy'),
      makeQADimension('audio-quality'),
      makeQADimension('visual-quality'),
      makeQADimension('seo-optimization'),
      makeQADimension('originality'),
    ],
    verdictReason: 'All dimensions above threshold.',
    evaluatedAt: new Date().toISOString(),
  };

  it('should parse a valid QA result with approved verdict', () => {
    expect(() => QAResultSchema.parse(validQAResult)).not.toThrow();
  });

  it('should accept rejected and flagged verdicts', () => {
    expect(() => QAResultSchema.parse({ ...validQAResult, verdict: 'rejected', overallScore: 35 })).not.toThrow();
    expect(() => QAResultSchema.parse({ ...validQAResult, verdict: 'flagged', overallScore: 60 })).not.toThrow();
  });

  it('should reject a verdict value not in the allowed enum', () => {
    expect(() => QAResultSchema.parse({ ...validQAResult, verdict: 'pending' })).toThrow(ZodError);
  });

  it('should reject a dimension with a score outside 0-100', () => {
    const badDimension = { ...makeQADimension('script-quality'), score: 110 };
    expect(() => QADimensionSchema.parse(badDimension)).toThrow(ZodError);
  });

  it('should require exactly 6 dimensions', () => {
    const fiveDimensions = validQAResult.dimensions.slice(0, 5);
    expect(() => QAResultSchema.parse({ ...validQAResult, dimensions: fiveDimensions })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// PublishRecordSchema
// ---------------------------------------------------------------------------
describe('T002 — PublishRecordSchema', () => {
  const validRecord: PublishRecord = {
    topicId: 'topic-abc123',
    runId: 'run-uuid-001',
    status: 'published',
    youtubeVideoId: 'dQw4w9WgXcQ',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'GPT-5: The Complete Developer Guide',
    publishedAt: new Date().toISOString(),
  };

  it('should parse a valid publish record', () => {
    expect(() => PublishRecordSchema.parse(validRecord)).not.toThrow();
  });

  it('should accept a skipped status without a YouTube video ID', () => {
    const skipped: PublishRecord = {
      topicId: 'topic-abc123',
      runId: 'run-uuid-002',
      status: 'skipped',
      skipReason: 'verdict was rejected',
      title: 'GPT-5: The Complete Developer Guide',
      publishedAt: new Date().toISOString(),
    };
    expect(() => PublishRecordSchema.parse(skipped)).not.toThrow();
  });

  it('should reject an invalid status value', () => {
    expect(() => PublishRecordSchema.parse({ ...validRecord, status: 'uploading' })).toThrow(ZodError);
  });

  it('should reject a record missing the runId', () => {
    const { runId: _omitted, ...rest } = validRecord;
    expect(() => PublishRecordSchema.parse(rest)).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// AgentErrorSchema
// ---------------------------------------------------------------------------
describe('T002 — AgentErrorSchema', () => {
  const validError: AgentError = {
    agentName: 'TrendScout',
    runId: 'run-uuid-001',
    errorType: 'transient',
    message: 'RSS feed timed out',
    stack: 'Error: RSS feed timed out\n  at rss-fetcher.ts:42',
    occurredAt: new Date().toISOString(),
  };

  it('should parse a valid agent error', () => {
    expect(() => AgentErrorSchema.parse(validError)).not.toThrow();
  });

  it('should accept all three error type values', () => {
    expect(() => AgentErrorSchema.parse({ ...validError, errorType: 'transient' })).not.toThrow();
    expect(() => AgentErrorSchema.parse({ ...validError, errorType: 'recoverable' })).not.toThrow();
    expect(() => AgentErrorSchema.parse({ ...validError, errorType: 'fatal' })).not.toThrow();
  });

  it('should reject an unknown errorType', () => {
    expect(() => AgentErrorSchema.parse({ ...validError, errorType: 'unknown' })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// SSEEventSchema
// ---------------------------------------------------------------------------
describe('T002 — SSEEventSchema', () => {
  // Acceptance: "All schemas importable via @shared/schemas/*"
  it('should parse a pipeline:started event', () => {
    const event = { type: 'pipeline:started', runId: 'run-001', timestamp: new Date().toISOString() };
    expect(() => SSEEventSchema.parse(event)).not.toThrow();
  });

  it('should parse an agent:completed event', () => {
    const event = {
      type: 'agent:completed',
      runId: 'run-001',
      agentName: 'TrendScout',
      durationMs: 3200,
      timestamp: new Date().toISOString(),
    };
    expect(() => SSEEventSchema.parse(event)).not.toThrow();
  });

  it('should parse an agent:failed event', () => {
    const event = {
      type: 'agent:failed',
      runId: 'run-001',
      agentName: 'ResearchCrawler',
      error: 'Playwright timeout',
      timestamp: new Date().toISOString(),
    };
    expect(() => SSEEventSchema.parse(event)).not.toThrow();
  });

  it('should reject an unknown SSE event type', () => {
    const event = { type: 'unknown:event', runId: 'run-001', timestamp: new Date().toISOString() };
    expect(() => SSEEventSchema.parse(event)).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// RunMetaSchema
// ---------------------------------------------------------------------------
describe('T002 — RunMetaSchema', () => {
  const validMeta: RunMeta = {
    runId: 'run-uuid-001',
    status: 'running',
    triggeredBy: 'cron',
    startedAt: new Date().toISOString(),
  };

  it('should parse a valid _meta.json object', () => {
    expect(() => RunMetaSchema.parse(validMeta)).not.toThrow();
  });

  it('should accept all status values', () => {
    const statuses = ['running', 'completed', 'failed', 'dead-letter'] as const;
    for (const status of statuses) {
      expect(() => RunMetaSchema.parse({ ...validMeta, status })).not.toThrow();
    }
  });

  it('should reject an invalid triggeredBy value', () => {
    expect(() => RunMetaSchema.parse({ ...validMeta, triggeredBy: 'bot' })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// API response schemas
// ---------------------------------------------------------------------------
describe('T002 — API Response Schemas', () => {
  it('should parse a valid ApiSuccessSchema response', () => {
    const resp = { success: true, data: { foo: 'bar' } };
    expect(() => ApiSuccessSchema.parse(resp)).not.toThrow();
  });

  it('should parse a valid ApiErrorSchema response', () => {
    const resp = { success: false, error: 'Not found', code: 404 };
    expect(() => ApiErrorSchema.parse(resp)).not.toThrow();
  });

  it('should reject ApiSuccessSchema when success is false', () => {
    expect(() => ApiSuccessSchema.parse({ success: false, data: null })).toThrow(ZodError);
  });

  it('should parse a valid PaginatedSchema response', () => {
    const resp = { success: true, data: [], meta: { total: 0, page: 1, limit: 20 } };
    expect(() => PaginatedSchema.parse(resp)).not.toThrow();
  });
});
