import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { PublishRecordSchema } from '@shared/schemas';
import { PublisherAgent } from '../index';
import { getValidAccessToken } from '../youtube-auth';
import { uploadVideo } from '../uploader';
import { calculatePublishTime } from '../scheduler';
import { optimizeMetadata } from '../metadata-optimizer';
import type { AgentContext } from '@shared/types/agent';
import type { QAResult, ContentBundle } from '@shared/schemas';

// T011 — Publisher Agent
// Tests will fail at import until publisher modules are implemented.

// ---------------------------------------------------------------------------
// Hoisted mock functions — must be declared via vi.hoisted() so they are
// available when vi.mock() factory functions are executed (vi.mock is hoisted
// to the top of the module before any variable declarations).
// ---------------------------------------------------------------------------
const { mockGetToken, mockUpload, mockOAuth2Instance, mockYoutubeInsert } = vi.hoisted(() => ({
  mockGetToken: vi.fn(),
  mockUpload: vi.fn(),
  mockOAuth2Instance: {
    setCredentials: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: 'ACCESS_TOKEN_xyz' }),
  },
  mockYoutubeInsert: vi.fn().mockResolvedValue({
    data: {
      id: 'dQw4w9WgXcQ',
      status: { uploadStatus: 'uploaded', privacyStatus: 'public' },
      snippet: { title: 'GPT-5: The Complete Developer Migration Guide' },
    },
  }),
}));

// ---------------------------------------------------------------------------
// Top-level module mocks (hoisted by Vitest)
// ---------------------------------------------------------------------------
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class MockOAuth2 {
        constructor() {
          Object.assign(this, mockOAuth2Instance);
        }
        setCredentials = mockOAuth2Instance.setCredentials;
        getAccessToken = mockOAuth2Instance.getAccessToken;
      },
    },
    youtube: vi.fn().mockReturnValue({
      videos: { insert: mockYoutubeInsert },
    }),
  },
}));

vi.mock('../youtube-auth', () => ({ getValidAccessToken: mockGetToken }));
vi.mock('../uploader', () => ({ uploadVideo: mockUpload }));
vi.mock('../scheduler', () => ({ calculatePublishTime: vi.fn() }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const APPROVED_QA_RESULT: QAResult = {
  topicId: 'topic-001',
  overallScore: 82,
  verdict: 'approved',
  dimensions: [
    { dimension: 'script-quality', score: 82, feedback: 'Good', issues: [] },
    { dimension: 'factual-accuracy', score: 78, feedback: 'Good', issues: [] },
    { dimension: 'audio-quality', score: 85, feedback: 'Good', issues: [] },
    { dimension: 'visual-quality', score: 80, feedback: 'Good', issues: [] },
    { dimension: 'seo-optimization', score: 88, feedback: 'Good', issues: [] },
    { dimension: 'originality', score: 75, feedback: 'Good', issues: [] },
  ],
  verdictReason: 'All dimensions above threshold.',
  evaluatedAt: new Date().toISOString(),
};

const REJECTED_QA_RESULT: QAResult = {
  ...APPROVED_QA_RESULT,
  overallScore: 32,
  verdict: 'rejected',
  verdictReason: 'Script quality below minimum threshold.',
};

const FLAGGED_QA_RESULT: QAResult = {
  ...APPROVED_QA_RESULT,
  overallScore: 58,
  verdict: 'flagged',
  verdictReason: 'Requires human review.',
};

const CONTENT_BUNDLE: ContentBundle = {
  topicId: 'topic-001',
  title: 'GPT-5: The Complete Developer Migration Guide',
  description: 'Everything developers need to know about migrating to GPT-5.',
  tags: ['GPT-5', 'OpenAI', 'LLM', 'Developer'],
  sections: [
    { type: 'hook', content: 'Hook text', durationSeconds: 15 },
    { type: 'intro', content: 'Intro text', durationSeconds: 30 },
    { type: 'body', content: 'Body text', durationSeconds: 180 },
    { type: 'cta', content: 'CTA text', durationSeconds: 15 },
    { type: 'outro', content: 'Outro text', durationSeconds: 10 },
  ],
  narrationPath: 'assets/narration.mp3',
  videoPath: 'assets/video.mp4',
  totalDurationSeconds: 250,
  claudeTokensUsed: 3800,
  producedAt: new Date().toISOString(),
};

const YOUTUBE_UPLOAD_RESPONSE = {
  id: 'dQw4w9WgXcQ',
  status: { uploadStatus: 'uploaded', privacyStatus: 'public' },
  snippet: { title: 'GPT-5: The Complete Developer Migration Guide' },
};

// ---------------------------------------------------------------------------
// YouTube Auth
// ---------------------------------------------------------------------------
describe('T011 — getValidAccessToken', () => {
  let realGetValidAccessToken: typeof getValidAccessToken;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../youtube-auth')>('../youtube-auth');
    realGetValidAccessToken = actual.getValidAccessToken;
  });

  beforeEach(() => {
    vi.mocked(getValidAccessToken).mockImplementation(realGetValidAccessToken);
    mockOAuth2Instance.setCredentials.mockClear();
    mockOAuth2Instance.getAccessToken.mockReset();
    mockOAuth2Instance.getAccessToken.mockResolvedValue({ token: 'ACCESS_TOKEN_xyz' });
  });

  it('should return a valid access token string', async () => {
    const token = await getValidAccessToken({
      clientId: 'FAKE_CLIENT_ID',
      clientSecret: 'FAKE_CLIENT_SECRET',
      refreshToken: 'FAKE_REFRESH_TOKEN',
    });

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  // Acceptance: "OAuth2 token expiry triggers fatal error (not retried as transient)"
  it('should throw a fatal error when the refresh token is revoked', async () => {
    mockOAuth2Instance.getAccessToken.mockRejectedValueOnce(
      Object.assign(new Error('Token has been revoked'), { code: 401 })
    );

    await expect(
      getValidAccessToken({
        clientId: 'FAKE_CLIENT_ID',
        clientSecret: 'FAKE_CLIENT_SECRET',
        refreshToken: 'REVOKED_REFRESH_TOKEN',
      })
    ).rejects.toThrow();
  });

  it('should throw when OAuth2 credentials are missing', async () => {
    await expect(
      getValidAccessToken({ clientId: '', clientSecret: '', refreshToken: '' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Uploader
// ---------------------------------------------------------------------------
describe('T011 — uploadVideo', () => {
  const runDir = '/tmp/run-publisher-001';
  let realUploadVideo: typeof uploadVideo;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../uploader')>('../uploader');
    realUploadVideo = actual.uploadVideo;
    // Create the test directory once for all upload tests
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/assets/video.mp4`, Buffer.alloc(100));
  });

  afterAll(async () => {
    // Clean up after all upload tests to avoid ENOENT race from createReadStream
    const fs = await import('node:fs');
    // Small delay to let pending streams close
    await new Promise((resolve) => setTimeout(resolve, 50));
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.mocked(uploadVideo).mockImplementation(realUploadVideo as any);
    mockYoutubeInsert.mockClear();
    mockYoutubeInsert.mockResolvedValue({ data: YOUTUBE_UPLOAD_RESPONSE });
  });

  // Acceptance: "Video uploaded with correct metadata (title, description, tags, category)"
  it('should upload the video and return the YouTube video ID and URL', async () => {
    const result = await uploadVideo(
      {
        videoPath: `${runDir}/assets/video.mp4`,
        title: CONTENT_BUNDLE.title,
        description: CONTENT_BUNDLE.description,
        tags: CONTENT_BUNDLE.tags,
        privacyStatus: 'public',
      },
      'FAKE_ACCESS_TOKEN',
    );

    expect(result.videoId).toBe('dQw4w9WgXcQ');
    expect(result.videoUrl).toContain('youtube.com');
  });

  it('should set the category to Science & Technology (id 28)', async () => {
    await uploadVideo(
      {
        videoPath: `${runDir}/assets/video.mp4`,
        title: CONTENT_BUNDLE.title,
        description: CONTENT_BUNDLE.description,
        tags: CONTENT_BUNDLE.tags,
        privacyStatus: 'public',
      },
      'FAKE_ACCESS_TOKEN',
    );

    const callArgs = mockYoutubeInsert.mock.calls[0][0];
    expect(callArgs.requestBody.snippet.categoryId).toBe('28');
  });

  it('should throw when the YouTube upload API returns an error', async () => {
    mockYoutubeInsert.mockRejectedValueOnce(new Error('Quota exceeded'));

    await expect(
      uploadVideo(
        { videoPath: `${runDir}/assets/video.mp4`, title: 'Test', description: 'Test', tags: [], privacyStatus: 'public' },
        'FAKE_ACCESS_TOKEN',
      )
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------
describe('T011 — calculatePublishTime', () => {
  let realCalculatePublishTime: typeof calculatePublishTime;

  beforeAll(async () => {
    const actual = await vi.importActual<typeof import('../scheduler')>('../scheduler');
    realCalculatePublishTime = actual.calculatePublishTime;
  });

  beforeEach(() => {
    vi.mocked(calculatePublishTime).mockImplementation(realCalculatePublishTime as any);
  });

  it('should return a future ISO date string', () => {
    const publishAt = calculatePublishTime({ preferredHour: 14, timezone: 'America/New_York' });
    const date = new Date(publishAt);
    expect(date.getTime()).toBeGreaterThan(Date.now());
  });

  it('should return undefined when scheduling is disabled', () => {
    const publishAt = calculatePublishTime({ enabled: false });
    expect(publishAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Metadata Optimizer
// ---------------------------------------------------------------------------
describe('T011 — optimizeMetadata', () => {
  // Acceptance: "Ensure title <= 100 chars"
  it('should truncate title to 100 characters', () => {
    const longTitle = 'A'.repeat(150);
    const { title } = optimizeMetadata({ title: longTitle, description: 'Test', tags: [] });
    expect(title.length).toBeLessThanOrEqual(100);
  });

  // Acceptance: "Ensure description <= 5000 chars"
  it('should truncate description to 5000 characters', () => {
    const longDescription = 'B'.repeat(6000);
    const { description } = optimizeMetadata({ title: 'Test', description: longDescription, tags: [] });
    expect(description.length).toBeLessThanOrEqual(5000);
  });

  // Acceptance: "Clean and deduplicate tags"
  it('should deduplicate tags case-insensitively', () => {
    const { tags } = optimizeMetadata({
      title: 'Test',
      description: 'Test',
      tags: ['AI', 'ai', 'OpenAI', 'LLM', 'llm'],
    });
    const lowercasedTags = tags.map((t: string) => t.toLowerCase());
    const uniqueLowercased = new Set(lowercasedTags);
    expect(lowercasedTags.length).toBe(uniqueLowercased.size);
  });

  it('should preserve tags that are within the limit', () => {
    const { tags } = optimizeMetadata({
      title: 'Test',
      description: 'Test',
      tags: ['GPT-5', 'OpenAI', 'LLM'],
    });
    expect(tags).toContain('GPT-5');
    expect(tags).toContain('OpenAI');
  });
});

// ---------------------------------------------------------------------------
// Full agent lifecycle
// ---------------------------------------------------------------------------
describe('T011 — PublisherAgent lifecycle', () => {
  beforeEach(() => {
    // Reset all module mocks to controlled behavior for lifecycle tests
    mockGetToken.mockReset();
    mockGetToken.mockResolvedValue('VALID_ACCESS_TOKEN');
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ videoId: 'dQw4w9WgXcQ', videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ' });
    vi.mocked(calculatePublishTime).mockReset();
    vi.mocked(calculatePublishTime).mockReturnValue(undefined);
    vi.mocked(getValidAccessToken).mockReset();
    vi.mocked(getValidAccessToken).mockResolvedValue('VALID_ACCESS_TOKEN');
    vi.mocked(uploadVideo).mockReset();
    vi.mocked(uploadVideo).mockResolvedValue({ videoId: 'dQw4w9WgXcQ', videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ' });
  });

  function makeCtx(runDir: string): AgentContext {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE pipeline_runs (id TEXT PRIMARY KEY, status TEXT, started_at TEXT, triggered_by TEXT DEFAULT 'manual');
      CREATE TABLE agent_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, agent_name TEXT, status TEXT,
        started_at TEXT, completed_at TEXT, duration_ms INTEGER, output_file TEXT, error TEXT, metrics_json TEXT
      );
      CREATE TABLE publish_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, topic_id TEXT, youtube_video_id TEXT,
        youtube_url TEXT, title TEXT, status TEXT, scheduled_at TEXT, created_at TEXT
      );
      INSERT INTO pipeline_runs VALUES ('run-pub-001', 'running', '${new Date().toISOString()}', 'manual');
    `);

    return {
      runId: 'run-pub-001',
      runDir,
      db,
      emitter: { broadcast: vi.fn() } as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    };
  }

  // Acceptance: "Agent extends BaseAgent with inputFile: 'qa-result.json', outputFile: 'publish-log.json'"
  it('should have inputFile qa-result.json and outputFile publish-log.json', () => {
    const agent = new PublisherAgent();
    expect((agent as any).inputFile).toBe('qa-result.json');
    expect((agent as any).outputFile).toBe('publish-log.json');
  });

  // Acceptance: "Skips upload when verdict is rejected or flagged"
  it('should skip upload and write a skipped publish-log when verdict is rejected', async () => {
    const runDir = '/tmp/run-pub-rejected';
    const agent = new PublisherAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${runDir}/qa-result.json`, JSON.stringify(REJECTED_QA_RESULT));
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    const result = await agent.execute(ctx);

    expect(result.success).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();

    if (result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(output.status).toBe('skipped');
    }

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('should skip upload and write a skipped publish-log when verdict is flagged', async () => {
    const runDir = '/tmp/run-pub-flagged';
    const agent = new PublisherAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(`${runDir}/qa-result.json`, JSON.stringify(FLAGGED_QA_RESULT));
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(true);
    expect(mockUpload).not.toHaveBeenCalled();

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "Output validates against PublishRecordSchema"
  it('should produce output that validates against PublishRecordSchema on successful upload', async () => {
    const runDir = '/tmp/run-pub-success';
    const agent = new PublisherAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/assets/video.mp4`, Buffer.alloc(100));
    fs.writeFileSync(`${runDir}/qa-result.json`, JSON.stringify(APPROVED_QA_RESULT));
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    const result = await agent.execute(ctx);

    if (result.success && result.outputPath) {
      const output = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
      expect(() => PublishRecordSchema.parse(output)).not.toThrow();
    }

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "Publish record also written to SQLite publish_log table"
  it('should write the publish record to the SQLite publish_log table', async () => {
    const runDir = '/tmp/run-pub-sqlite';
    const agent = new PublisherAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/assets/video.mp4`, Buffer.alloc(100));
    fs.writeFileSync(`${runDir}/qa-result.json`, JSON.stringify(APPROVED_QA_RESULT));
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    await agent.execute(ctx);

    const row = ctx.db
      .prepare('SELECT * FROM publish_log WHERE run_id = ?')
      .get('run-pub-001') as { youtube_video_id: string; status: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.youtube_video_id).toBe('dQw4w9WgXcQ');
    expect(row!.status).toBe('published');

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // Acceptance: "OAuth2 token refreshed before each upload"
  it('should refresh the OAuth2 token before calling uploadVideo', async () => {
    vi.mocked(getValidAccessToken).mockReset();
    vi.mocked(getValidAccessToken).mockResolvedValue('FRESH_TOKEN');
    vi.mocked(uploadVideo).mockReset();
    vi.mocked(uploadVideo).mockResolvedValue({ videoId: 'abc', videoUrl: 'https://youtube.com/watch?v=abc' });

    const runDir = '/tmp/run-pub-token-refresh';
    const agent = new PublisherAgent();
    const ctx = makeCtx(runDir);
    const fs = await import('node:fs');
    fs.mkdirSync(`${runDir}/assets`, { recursive: true });
    fs.writeFileSync(`${runDir}/assets/video.mp4`, Buffer.alloc(100));
    fs.writeFileSync(`${runDir}/qa-result.json`, JSON.stringify(APPROVED_QA_RESULT));
    fs.writeFileSync(`${runDir}/content.json`, JSON.stringify(CONTENT_BUNDLE));

    await agent.execute(ctx);

    expect(vi.mocked(getValidAccessToken)).toHaveBeenCalledOnce();

    // Ensure upload was called with the freshly-obtained token
    const uploadCallArgs = vi.mocked(uploadVideo).mock.calls[0];
    expect(uploadCallArgs[1]).toBe('FRESH_TOKEN');

    fs.rmSync(runDir, { recursive: true, force: true });
  });
});
