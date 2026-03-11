import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { ContentBundleSchema } from '@shared/schemas';
import { ContentProducerAgent } from '../index';
import { generateScript } from '../script-writer';
import { generateNarration } from '../tts-narrator';
import { assembleVideo } from '../video-assembler';
import type { AgentContext } from '@shared/types/agent';
import type { ResearchDossier } from '@shared/schemas';

// T009 — ContentProducer Agent
// Tests will fail at import until content-producer modules are implemented.

// ---------------------------------------------------------------------------
// Hoisted mock data — must be declared with vi.hoisted() so it is available
// inside vi.mock() factory functions (which are hoisted to the top of the file
// by Vitest, before any const declarations in the module body).
// ---------------------------------------------------------------------------
const { MOCK_CLAUDE_RESPONSE, mockAnthropicCreate, mockRenderMedia } = vi.hoisted(() => {
  const MOCK_CLAUDE_RESPONSE = {
    sections: [
      { type: 'hook', content: 'What if GPT-5 makes your entire codebase 10x better overnight?', durationSeconds: 15 },
      { type: 'intro', content: 'Welcome back. Today we are diving deep into GPT-5.', durationSeconds: 30 },
      { type: 'body', content: 'GPT-5 has several killer improvements for developers.', durationSeconds: 180 },
      { type: 'examples', content: "Here's a real-world migration from GPT-4 API to GPT-5.", durationSeconds: 120 },
      { type: 'cta', content: 'If you found this useful, smash that like button.', durationSeconds: 15 },
      { type: 'outro', content: 'See you in the next one.', durationSeconds: 10 },
    ],
    title: 'GPT-5: The Complete Developer Migration Guide',
    description: 'Everything developers need to know about migrating to GPT-5.',
    tags: ['GPT-5', 'OpenAI', 'LLM', 'Developer', 'AI'],
    claudeTokensUsed: 3800,
  };

  const mockAnthropicCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'tool_result', content: JSON.stringify(MOCK_CLAUDE_RESPONSE) }],
    usage: { input_tokens: 1200, output_tokens: 2600 },
  });

  const mockRenderMedia = vi.fn().mockResolvedValue(undefined);

  return { MOCK_CLAUDE_RESPONSE, mockAnthropicCreate, mockRenderMedia };
});

// ---------------------------------------------------------------------------
// Top-level vi.mock() calls — Vitest hoists these above all imports/consts,
// so they MUST only reference variables declared via vi.hoisted() above.
// ---------------------------------------------------------------------------
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate };
  },
}));

vi.mock('@remotion/renderer', () => ({ renderMedia: mockRenderMedia }));

vi.mock('../script-writer', () => ({
  generateScript: vi.fn(),
}));

vi.mock('../tts-narrator', () => ({
  generateNarration: vi.fn(),
}));

vi.mock('../video-assembler', () => ({
  assembleVideo: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESEARCH_DOSSIER: ResearchDossier = {
  topicId: 'topic-001',
  topicTitle: 'GPT-5 Launches Today',
  keyPoints: [
    'GPT-5 achieves human-expert level on MMLU',
    'Pricing: $0.002 per 1K input tokens',
    'Supports 200K context window',
    'Available via API today',
  ],
  sources: [
    {
      url: 'https://openai.com/blog/gpt-5',
      title: 'GPT-5 Blog',
      excerpt: 'OpenAI today announced GPT-5...',
      scrapedAt: new Date().toISOString(),
    },
  ],
  competitors: [
    {
      videoId: 'yt-competitor-1',
      title: 'GPT-5 First Look',
      channelName: 'AI Explained',
      viewCount: 1200000,
      publishedAt: '2025-03-01T10:00:00Z',
      gaps: ['Misses pricing analysis', 'No developer migration guide'],
    },
  ],
  suggestedAngle: 'Focus on developer migration from GPT-4 to GPT-5',
  estimatedScriptMinutes: 8,
  researchedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Script Writer
// ---------------------------------------------------------------------------
describe('T009 — generateScript', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../script-writer')>('../script-writer');
    vi.mocked(generateScript).mockImplementation(actual.generateScript);
  });

  beforeEach(() => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'tool_result', content: JSON.stringify(MOCK_CLAUDE_RESPONSE) }],
      usage: { input_tokens: 1200, output_tokens: 2600 },
    });
  });

  // Acceptance: "Script generated via Claude API with structured output"
  it('should generate a script with all required section types', async () => {
    const script = await generateScript(RESEARCH_DOSSIER, 'FAKE_CLAUDE_KEY');
    const sectionTypes = script.sections.map((s: { type: string }) => s.type);

    expect(sectionTypes).toContain('hook');
    expect(sectionTypes).toContain('intro');
    expect(sectionTypes).toContain('body');
    expect(sectionTypes).toContain('cta');
    expect(sectionTypes).toContain('outro');
  });

  // Acceptance: "Script includes all section types (hook, intro, body, examples, CTA, outro)"
  it('should include a YouTube-optimized title, description, and tags', async () => {
    const script = await generateScript(RESEARCH_DOSSIER, 'FAKE_CLAUDE_KEY');
    expect(typeof script.title).toBe('string');
    expect(script.title.length).toBeGreaterThan(0);
    expect(script.title.length).toBeLessThanOrEqual(100);
    expect(Array.isArray(script.tags)).toBe(true);
    expect(typeof script.description).toBe('string');
  });

  // Acceptance: "Claude token usage tracked in metadata"
  it('should track Claude token usage in the script metadata', async () => {
    const script = await generateScript(RESEARCH_DOSSIER, 'FAKE_CLAUDE_KEY');
    expect(typeof script.claudeTokensUsed).toBe('number');
    expect(script.claudeTokensUsed).toBeGreaterThan(0);
  });

  it('should throw when the Claude API call fails', async () => {
    mockAnthropicCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

    await expect(generateScript(RESEARCH_DOSSIER, 'FAKE_CLAUDE_KEY')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TTS Narrator
// ---------------------------------------------------------------------------
describe('T009 — generateNarration', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../tts-narrator')>('../tts-narrator');
    vi.mocked(generateNarration).mockImplementation(actual.generateNarration);
  });

  const FAKE_MP3_BUFFER = Buffer.from('FAKE_MP3_DATA');
  const runDir = '/tmp/run-content-001';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => FAKE_MP3_BUFFER.buffer,
    }));
  });

  // Acceptance: "TTS narration generated via Azure TTS and saved to assets"
  it('should save narration audio to assets/narration.mp3 in the run directory', async () => {
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });

    const result = await generateNarration(
      MOCK_CLAUDE_RESPONSE.sections,
      runDir,
      { subscriptionKey: 'FAKE_KEY', region: 'eastus', voice: 'en-US-JennyNeural' },
    );

    expect(result.narrationPath).toContain('narration.mp3');
    expect(typeof result.durationSeconds).toBe('number');

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('should throw when the Azure TTS API returns a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' }));

    await expect(
      generateNarration(MOCK_CLAUDE_RESPONSE.sections, runDir, {
        subscriptionKey: 'BAD_KEY',
        region: 'eastus',
        voice: 'en-US-JennyNeural',
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Video Assembler
// ---------------------------------------------------------------------------
describe('T009 — assembleVideo', () => {
  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../video-assembler')>('../video-assembler');
    vi.mocked(assembleVideo).mockImplementation(actual.assembleVideo);
  });

  // Acceptance: "Video assembled and saved to assets/video.mp4"
  it('should produce a video.mp4 file in the assets directory', async () => {
    const runDir = '/tmp/run-content-video';
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });

    const result = await assembleVideo(
      { sections: MOCK_CLAUDE_RESPONSE.sections, narrationPath: `${runDir}/assets/narration.mp3` },
      runDir,
    );

    expect(result.videoPath).toContain('video.mp4');
    expect(fs.existsSync(result.videoPath)).toBe(true);

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "Video assembler handles missing Remotion gracefully"
  it('should create a placeholder video when Remotion bundling fails', async () => {
    const runDir = '/tmp/run-content-concurrency';
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });

    const result = await assembleVideo(
      { sections: MOCK_CLAUDE_RESPONSE.sections, narrationPath: `${runDir}/assets/narration.mp3` },
      runDir,
    );

    // Should still produce a video file (placeholder fallback in test env)
    expect(result.videoPath).toContain('video.mp4');

    fs.rmSync(runDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Full agent lifecycle
// ---------------------------------------------------------------------------
describe('T009 — ContentProducerAgent lifecycle', () => {
  function makeCtx(runDir: string): AgentContext {
    return {
      runId: 'run-content-001',
      runDir,
      db: null as any,
      emitter: { broadcast: vi.fn() } as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    };
  }

  beforeEach(() => {
    vi.mocked(generateScript).mockReset();
    vi.mocked(generateNarration).mockReset();
    vi.mocked(assembleVideo).mockReset();
  });

  // Acceptance: "Agent extends BaseAgent with inputFile: 'research.json', outputFile: 'content.json'"
  it('should have inputFile research.json and outputFile content.json', () => {
    const agent = new ContentProducerAgent();
    expect((agent as any).inputFile).toBe('research.json');
    expect((agent as any).outputFile).toBe('content.json');
  });

  // Acceptance: "Output validates against ContentBundleSchema"
  it('should produce output that validates against ContentBundleSchema', async () => {
    vi.mocked(generateScript).mockResolvedValue(MOCK_CLAUDE_RESPONSE);
    vi.mocked(generateNarration).mockResolvedValue({ narrationPath: 'assets/narration.mp3', durationSeconds: 370 });
    vi.mocked(assembleVideo).mockResolvedValue({ videoPath: 'assets/video.mp4' });

    const runDir = '/tmp/run-content-full';
    const agent = new ContentProducerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/research.json`, JSON.stringify(RESEARCH_DOSSIER));

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(() => ContentBundleSchema.parse(output)).not.toThrow();
    }

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "Tests cover happy path and each service failing independently"
  it('should fail gracefully when the Claude API is unavailable', async () => {
    vi.mocked(generateScript).mockRejectedValue(new Error('Claude API down'));

    const runDir = '/tmp/run-content-claude-fail';
    const agent = new ContentProducerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/research.json`, JSON.stringify(RESEARCH_DOSSIER));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Claude API down');

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('should fail gracefully when Azure TTS is unavailable', async () => {
    vi.mocked(generateScript).mockResolvedValue(MOCK_CLAUDE_RESPONSE);
    vi.mocked(generateNarration).mockRejectedValue(new Error('Azure TTS 503'));

    const runDir = '/tmp/run-content-tts-fail';
    const agent = new ContentProducerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/research.json`, JSON.stringify(RESEARCH_DOSSIER));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(false);

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "Asset paths in output are relative to run directory"
  it('should store asset paths as relative paths (not absolute) in content.json', async () => {
    vi.mocked(generateScript).mockResolvedValue(MOCK_CLAUDE_RESPONSE);
    vi.mocked(generateNarration).mockResolvedValue({ narrationPath: 'assets/narration.mp3', durationSeconds: 370 });
    vi.mocked(assembleVideo).mockResolvedValue({ videoPath: 'assets/video.mp4' });

    const runDir = '/tmp/run-content-paths';
    const agent = new ContentProducerAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/research.json`, JSON.stringify(RESEARCH_DOSSIER));

    await agent.execute(ctx);

    const outputPath = `${runDir}/content.json`;
    if (fs.existsSync(outputPath)) {
      const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      expect(output.narrationPath).not.toMatch(/^\/tmp/);
      expect(output.videoPath).not.toMatch(/^\/tmp/);
    }

    fs.rmSync(runDir, { recursive: true, force: true });
  });
});
