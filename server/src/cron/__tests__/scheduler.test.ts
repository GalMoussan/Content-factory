import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { startScheduler, stopScheduler } from '../scheduler';

// T017 — Cron Scheduler
// Tests will fail at import until scheduler.ts is implemented.

// Mock node-cron so tests are not bound to wall-clock time
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expression: string, callback: () => void) => {
      // Expose the callback so tests can trigger it manually
      (globalThis as Record<string, unknown>).__cronCallback__ = callback;
      return { destroy: vi.fn(), stop: vi.fn() };
    }),
    validate: vi.fn(() => true),
  },
}));

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS circuit_breaker (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT NOT NULL DEFAULT 'CLOSED',
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      opened_at TEXT,
      last_failure_at TEXT
    );
    INSERT OR IGNORE INTO circuit_breaker (id) VALUES (1);
  `);
  return db;
}

describe('T017 — Cron Scheduler', () => {
  let db: Database.Database;
  let mockExecutePipeline: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = makeInMemoryDb();
    mockExecutePipeline = vi.fn().mockResolvedValue(undefined);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    stopScheduler();
    delete (globalThis as Record<string, unknown>).__cronCallback__;
  });

  // Acceptance: "Cron triggers pipeline on configured schedule"
  it('should schedule the cron job and trigger executePipeline when fired', async () => {
    startScheduler({ db, executePipeline: mockExecutePipeline });

    // Simulate cron tick
    const callback = (globalThis as Record<string, unknown>).__cronCallback__ as () => void;
    expect(typeof callback).toBe('function');

    await callback();

    expect(mockExecutePipeline).toHaveBeenCalledOnce();
  });

  // Acceptance: "Guard checked before every cron trigger"
  it('should call canStartPipeline before executing the pipeline', async () => {
    const mockGuard = vi.fn().mockReturnValue({ allowed: true });

    startScheduler({ db, executePipeline: mockExecutePipeline, canStartPipeline: mockGuard });

    const callback = (globalThis as Record<string, unknown>).__cronCallback__ as () => void;
    await callback();

    expect(mockGuard).toHaveBeenCalledOnce();
  });

  // Acceptance: "Skips silently (with log) when guard fails"
  it('should not execute the pipeline when guard returns allowed=false', async () => {
    const mockGuard = vi.fn().mockReturnValue({ allowed: false, reason: 'Circuit open' });
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    startScheduler({
      db,
      executePipeline: mockExecutePipeline,
      canStartPipeline: mockGuard,
      logger: mockLogger,
    });

    const callback = (globalThis as Record<string, unknown>).__cronCallback__ as () => void;
    await callback();

    expect(mockExecutePipeline).not.toHaveBeenCalled();
    // Must log why it was skipped
    const allLogCalls = [...mockLogger.info.mock.calls, ...mockLogger.warn.mock.calls];
    const logged = allLogCalls.some((args: unknown[]) =>
      args.some((a) => typeof a === 'string' && /skip|guard|circuit/i.test(a)),
    );
    expect(logged).toBe(true);
  });

  // Acceptance: "CRON_SCHEDULE env var configures schedule"
  it('should use the CRON_SCHEDULE env var when provided', async () => {
    vi.stubEnv('CRON_SCHEDULE', '0 8 * * 1');
    const cron = await import('node-cron');
    const scheduleSpy = vi.spyOn(cron.default, 'schedule');

    startScheduler({ db, executePipeline: mockExecutePipeline });

    expect(scheduleSpy).toHaveBeenCalledWith(
      '0 8 * * 1',
      expect.any(Function),
      expect.anything(),
    );
  });

  // Acceptance: "Scheduler starts automatically with Express server"
  it('should return a destroy/stop handle so the server can tear it down', () => {
    const handle = startScheduler({ db, executePipeline: mockExecutePipeline });
    expect(handle).toBeDefined();
    expect(typeof handle.stop === 'function' || typeof handle.destroy === 'function').toBe(true);
  });

  // Acceptance: "Default schedule is 0 6 * * *"
  it('should default to 0 6 * * * when CRON_SCHEDULE is not set', async () => {
    vi.unstubAllEnvs();
    const cron = await import('node-cron');
    const scheduleSpy = vi.spyOn(cron.default, 'schedule');

    startScheduler({ db, executePipeline: mockExecutePipeline });

    expect(scheduleSpy).toHaveBeenCalledWith(
      '0 6 * * *',
      expect.any(Function),
      expect.anything(),
    );
  });
});
