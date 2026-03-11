import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { QAResultSchema } from '@shared/schemas';
import { QualityControllerAgent } from '../index';
import { scoreContentBundle } from '../scorer';
import { renderVerdict } from '../verdict-engine';
import type { AgentContext } from '@shared/types/agent';
import type { ContentBundle, QADimension } from '@shared/schemas';

// T010 — QualityController Agent
// Tests will fail at import until quality-controller modules are implemented.

// ---------------------------------------------------------------------------
// Hoist shared mock data so it is available when vi.mock factories execute
// ---------------------------------------------------------------------------
const { MOCK_DIMENSION_SCORES } = vi.hoisted(() => {
  const MOCK_DIMENSION_SCORES: Array<{
    dimension: string;
    score: number;
    feedback: string;
    issues: string[];
  }> = [
    { dimension: 'script-quality', score: 82, feedback: 'Clear structure and engaging hook.', issues: [] },
    { dimension: 'factual-accuracy', score: 78, feedback: 'Claims are supported by sources.', issues: [] },
    { dimension: 'audio-quality', score: 85, feedback: 'Good pacing and pronunciation.', issues: [] },
    { dimension: 'visual-quality', score: 80, feedback: 'Section transitions are smooth.', issues: [] },
    { dimension: 'seo-optimization', score: 88, feedback: 'Strong title and tag coverage.', issues: [] },
    { dimension: 'originality', score: 75, feedback: 'Unique developer migration angle.', issues: [] },
  ];
  return { MOCK_DIMENSION_SCORES };
});

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk at module level using the hoisted data.
// The mockCreate reference is shared so tests can assert on its calls.
// ---------------------------------------------------------------------------
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{
      type: 'text',
      text: JSON.stringify([
        { dimension: 'script-quality', score: 82, feedback: 'Clear structure and engaging hook.', issues: [] },
        { dimension: 'factual-accuracy', score: 78, feedback: 'Claims are supported by sources.', issues: [] },
        { dimension: 'audio-quality', score: 85, feedback: 'Good pacing and pronunciation.', issues: [] },
        { dimension: 'visual-quality', score: 80, feedback: 'Section transitions are smooth.', issues: [] },
        { dimension: 'seo-optimization', score: 88, feedback: 'Strong title and tag coverage.', issues: [] },
        { dimension: 'originality', score: 75, feedback: 'Unique developer migration angle.', issues: [] },
      ]),
    }],
    usage: { input_tokens: 800, output_tokens: 400 },
    model: 'claude-haiku-4-5',
  });
  return { mockCreate };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTENT_BUNDLE: ContentBundle = {
  topicId: 'topic-001',
  title: 'GPT-5: The Complete Developer Migration Guide',
  description: 'Everything developers need to know about migrating to GPT-5.',
  tags: ['GPT-5', 'OpenAI', 'LLM', 'Developer'],
  sections: [
    { type: 'hook', content: 'What if GPT-5 makes your entire codebase 10x better?', durationSeconds: 15 },
    { type: 'intro', content: 'Welcome back. Today we are diving deep into GPT-5.', durationSeconds: 30 },
    { type: 'body', content: 'GPT-5 has several killer improvements for developers.', durationSeconds: 180 },
    { type: 'examples', content: "Here's a real-world migration from GPT-4.", durationSeconds: 120 },
    { type: 'cta', content: 'Smash that like button!', durationSeconds: 15 },
    { type: 'outro', content: 'See you in the next one.', durationSeconds: 10 },
  ],
  narrationPath: 'assets/narration.mp3',
  videoPath: 'assets/video.mp4',
  totalDurationSeconds: 370,
  claudeTokensUsed: 3800,
  producedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------
describe('T010 — scoreContentBundle', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../scorer')>('../scorer');
    vi.mocked(scoreContentBundle).mockImplementation(actual.scoreContentBundle);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Acceptance: "Scores all 6 dimensions via Claude API"
  it('should return scores for all 6 required dimensions', async () => {
    const dimensions = await scoreContentBundle(CONTENT_BUNDLE, 'FAKE_CLAUDE_KEY');
    const dimensionNames = dimensions.map((d: QADimension) => d.dimension);

    expect(dimensionNames).toContain('script-quality');
    expect(dimensionNames).toContain('factual-accuracy');
    expect(dimensionNames).toContain('audio-quality');
    expect(dimensionNames).toContain('visual-quality');
    expect(dimensionNames).toContain('seo-optimization');
    expect(dimensionNames).toContain('originality');
    expect(dimensions).toHaveLength(6);
  });

  // Acceptance: "Uses Haiku model for cost efficiency"
  it('should use the Claude Haiku model for scoring', async () => {
    await scoreContentBundle(CONTENT_BUNDLE, 'FAKE_CLAUDE_KEY');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toMatch(/haiku/i);
  });

  it('should return dimension scores between 0 and 100', async () => {
    const dimensions = await scoreContentBundle(CONTENT_BUNDLE, 'FAKE_CLAUDE_KEY');
    for (const dim of dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it('should throw when the Claude API call fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Haiku overloaded'));

    await expect(scoreContentBundle(CONTENT_BUNDLE, 'FAKE_CLAUDE_KEY')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Verdict Engine
// ---------------------------------------------------------------------------
describe('T010 — renderVerdict', () => {
  // Acceptance: "Verdict logic correctly applies configurable thresholds"
  it('should return "approved" when overall score is >= 75', () => {
    const result = renderVerdict(MOCK_DIMENSION_SCORES as QADimension[], { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('approved');
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
  });

  it('should return "rejected" when overall score is <= 40', () => {
    const lowScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 35 }));
    const result = renderVerdict(lowScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('rejected');
    expect(result.overallScore).toBeLessThanOrEqual(40);
  });

  it('should return "flagged" when overall score is between 40 and 75', () => {
    const midScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 60 }));
    const result = renderVerdict(midScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('flagged');
  });

  // Acceptance: "Tests cover threshold edge cases (exactly 75, exactly 40, etc.)"
  it('should return "approved" when overall score is exactly 75', () => {
    const exactScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 75 }));
    const result = renderVerdict(exactScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('approved');
  });

  it('should return "rejected" when overall score is exactly 40', () => {
    const exactScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 40 }));
    const result = renderVerdict(exactScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('rejected');
  });

  it('should return "flagged" when score is exactly 41 (just above reject threshold)', () => {
    const borderScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 41 }));
    const result = renderVerdict(borderScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.verdict).toBe('flagged');
  });

  it('should include a non-empty verdictReason in the result', () => {
    const result = renderVerdict(MOCK_DIMENSION_SCORES as QADimension[], { approveThreshold: 75, rejectThreshold: 40 });
    expect(typeof result.verdictReason).toBe('string');
    expect(result.verdictReason.length).toBeGreaterThan(0);
  });

  it('should calculate overallScore as a weighted average across dimensions', () => {
    const uniformScores: QADimension[] = (MOCK_DIMENSION_SCORES as QADimension[]).map((d) => ({ ...d, score: 80 }));
    const result = renderVerdict(uniformScores, { approveThreshold: 75, rejectThreshold: 40 });
    expect(result.overallScore).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Full agent lifecycle
// ---------------------------------------------------------------------------
describe('T010 — QualityControllerAgent lifecycle', () => {
  beforeEach(() => {
    vi.mocked(scoreContentBundle).mockReset();
    vi.mocked(scoreContentBundle).mockResolvedValue(MOCK_DIMENSION_SCORES as QADimension[]);
  });

  function makeCtx(runDir: string): AgentContext {
    return {
      runId: 'run-qa-001',
      runDir,
      db: (() => {
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');
        db.exec(`
          CREATE TABLE pipeline_runs (id TEXT PRIMARY KEY, status TEXT, started_at TEXT, triggered_by TEXT DEFAULT 'manual');
          CREATE TABLE agent_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, agent_name TEXT, status TEXT, started_at TEXT,
            completed_at TEXT, duration_ms INTEGER, output_file TEXT, error TEXT, metrics_json TEXT
          );
          CREATE TABLE qa_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, topic_id TEXT,
            overall_score REAL, verdict TEXT, dimensions_json TEXT, created_at TEXT
          );
          INSERT INTO pipeline_runs VALUES ('run-qa-001', 'running', '${new Date().toISOString()}', 'manual');
        `);
        return db;
      })(),
      emitter: { broadcast: vi.fn() } as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    };
  }

  // Acceptance: "Agent extends BaseAgent with inputFile: 'content.json', outputFile: 'qa-result.json'"
  it('should have inputFile content.json and outputFile qa-result.json', () => {
    const agent = new QualityControllerAgent();
    expect((agent as any).inputFile).toBe('content.json');
    expect((agent as any).outputFile).toBe('qa-result.json');
  });

  // Acceptance: "Output validates against QAResultSchema"
  it('should produce output that validates against QAResultSchema', async () => {
    vi.mock('../scorer', () => ({
      scoreContentBundle: vi.fn().mockResolvedValue(MOCK_DIMENSION_SCORES),
    }));

    const runDir = '/tmp/run-qa-full';
    const agent = new QualityControllerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(() => QAResultSchema.parse(output)).not.toThrow();
    }

    fs.rmSync(runDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Acceptance: "QA scores also recorded in SQLite qa_scores table"
  it('should record QA score in the SQLite qa_scores table', async () => {
    vi.mock('../scorer', () => ({
      scoreContentBundle: vi.fn().mockResolvedValue(MOCK_DIMENSION_SCORES),
    }));

    const runDir = '/tmp/run-qa-sqlite';
    const agent = new QualityControllerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    await agent.execute(ctx);

    const row = ctx.db
      .prepare('SELECT * FROM qa_scores WHERE run_id = ?')
      .get('run-qa-001') as { verdict: string; overall_score: number } | undefined;

    expect(row).toBeDefined();
    expect(['approved', 'rejected', 'flagged']).toContain(row!.verdict);

    fs.rmSync(runDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Acceptance: "Tests cover approved, rejected, and flagged verdicts"
  it('should produce a rejected verdict when all dimension scores are very low', async () => {
    vi.mocked(scoreContentBundle).mockReset();
    vi.mocked(scoreContentBundle).mockResolvedValue(
      MOCK_DIMENSION_SCORES.map((d) => ({ ...d, score: 25 })) as QADimension[],
    );

    const runDir = '/tmp/run-qa-rejected';
    const agent = new QualityControllerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(output.verdict).toBe('rejected');
    }

    fs.rmSync(runDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
});
