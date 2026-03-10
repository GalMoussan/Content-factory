import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// T024 — Environment Variable Validation
// Tests will fail at import until config/env.ts is implemented.
//
// IMPORTANT: env.ts calls process.exit(1) on validation failure.
// We must carefully control process.env and mock process.exit
// before importing the module under test.

const EXIT_SPY = vi.spyOn(process, 'exit').mockImplementation((() => {
  throw new Error('process.exit called');
}) as never);

const REQUIRED_VARS = {
  ANTHROPIC_API_KEY: 'sk-ant-test',
  YOUTUBE_CLIENT_ID: 'yt-client-id',
  YOUTUBE_CLIENT_SECRET: 'yt-client-secret',
  YOUTUBE_REFRESH_TOKEN: 'yt-refresh',
  AZURE_TTS_KEY: 'azure-tts-key',
  AZURE_TTS_REGION: 'eastus',
};

describe('T024 — Environment Variable Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear required vars before each test
    for (const key of Object.keys(REQUIRED_VARS)) {
      delete process.env[key];
    }
    // Reset module cache so env.ts re-evaluates process.env
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    EXIT_SPY.mockClear();
  });

  // Acceptance: "All required env vars validated at startup"
  it('should export a valid config object when all required vars are present', async () => {
    Object.assign(process.env, REQUIRED_VARS);
    const { config } = await import('../env');

    expect(config.anthropicApiKey).toBe('sk-ant-test');
    expect(config.youtubeClientId).toBe('yt-client-id');
    expect(config.azureTtsKey).toBe('azure-tts-key');
  });

  // Acceptance: "Process exits with code 1 on validation failure"
  it('should call process.exit(1) when a required var is missing', async () => {
    // Do NOT set any required vars
    await expect(import('../env')).rejects.toThrow('process.exit called');
    expect(EXIT_SPY).toHaveBeenCalledWith(1);
  });

  // Acceptance: "Clear error message listing ALL missing vars (not just first)"
  it('should log all missing variables before exiting', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await import('../env');
    } catch {
      // expected
    }

    const allOutput = consoleSpy.mock.calls.flat().join(' ');
    // Should mention more than one missing variable
    const mentionedVarCount = Object.keys(REQUIRED_VARS).filter((k) =>
      allOutput.includes(k),
    ).length;
    expect(mentionedVarCount).toBeGreaterThan(1);

    consoleSpy.mockRestore();
  });

  // Acceptance: "Default values for optional vars (PORT, CRON_SCHEDULE, LOG_LEVEL)"
  it('should apply default PORT 3001 when PORT is not set', async () => {
    Object.assign(process.env, REQUIRED_VARS);
    delete process.env.PORT;
    const { config } = await import('../env');
    expect(config.port).toBe(3001);
  });

  it('should apply default CRON_SCHEDULE 0 6 * * * when not set', async () => {
    Object.assign(process.env, REQUIRED_VARS);
    delete process.env.CRON_SCHEDULE;
    const { config } = await import('../env');
    expect(config.cronSchedule).toBe('0 6 * * *');
  });

  it('should apply default LOG_LEVEL info when not set', async () => {
    Object.assign(process.env, REQUIRED_VARS);
    delete process.env.LOG_LEVEL;
    const { config } = await import('../env');
    expect(config.logLevel).toBe('info');
  });

  // Acceptance: "Typed config object used throughout codebase"
  it('should expose the config object with camelCase typed fields', async () => {
    Object.assign(process.env, REQUIRED_VARS);
    const { config } = await import('../env');

    // Type-safety check: each field must be the correct primitive type
    expect(typeof config.port).toBe('number');
    expect(typeof config.cronSchedule).toBe('string');
    expect(typeof config.anthropicApiKey).toBe('string');
  });
});
