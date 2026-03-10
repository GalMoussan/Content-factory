import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { acquireLock, releaseLock, isLocked } from '../pipeline-lock';
import { canStartPipeline } from '../pipeline-guard';

// T015 — Pipeline Lock (Overlap Prevention)
// Tests will fail at import until pipeline-lock.ts and pipeline-guard.ts are implemented.

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

const TEST_LOCK_DIR = path.join(os.tmpdir(), `pipeline-lock-test-${process.pid}`);
const LOCK_FILE = path.join(TEST_LOCK_DIR, '.pipeline.lock');

describe('T015 — Pipeline Lock (Overlap Prevention)', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_LOCK_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up any residual lock files
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
    fs.rmSync(TEST_LOCK_DIR, { recursive: true, force: true });
  });

  // Acceptance: "Lock file prevents overlapping pipeline runs"
  it('should acquire lock successfully when no lock file exists', () => {
    const acquired = acquireLock('run-001', LOCK_FILE);
    expect(acquired).toBe(true);
    expect(isLocked(LOCK_FILE)).toBe(true);
  });

  it('should reject a second lock attempt when the first is still held', () => {
    acquireLock('run-001', LOCK_FILE);
    const second = acquireLock('run-002', LOCK_FILE);
    expect(second).toBe(false);
  });

  // Acceptance: "Lock released after pipeline completes"
  it('should release the lock and allow re-acquisition afterwards', () => {
    acquireLock('run-001', LOCK_FILE);
    releaseLock(LOCK_FILE);
    expect(isLocked(LOCK_FILE)).toBe(false);

    const reacquired = acquireLock('run-002', LOCK_FILE);
    expect(reacquired).toBe(true);
  });

  // Acceptance: "Stale locks detected via PID check (process.kill(pid, 0))"
  it('should treat a lock with a dead PID as stale and allow acquisition', () => {
    // Write a lock file with a PID that cannot possibly be alive
    const fakeLock = {
      pid: 999_999_999,
      runId: 'run-stale',
      startedAt: new Date().toISOString(),
    };
    fs.writeFileSync(LOCK_FILE, JSON.stringify(fakeLock), 'utf8');

    // isLocked must return false because the PID is dead
    expect(isLocked(LOCK_FILE)).toBe(false);

    // And acquire must succeed by removing the stale lock
    const acquired = acquireLock('run-003', LOCK_FILE);
    expect(acquired).toBe(true);
  });

  // Acceptance: "Lock file content: JSON with pid, runId, startedAt"
  it('should write a valid JSON lock file with pid, runId, and startedAt fields', () => {
    acquireLock('run-004', LOCK_FILE);
    const content = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
    expect(content.pid).toBe(process.pid);
    expect(content.runId).toBe('run-004');
    expect(typeof content.startedAt).toBe('string');
  });

  // Acceptance: "Combined guard checks circuit breaker + lock + SQLite"
  it('canStartPipeline should return allowed=true when all guards pass', () => {
    const db = makeInMemoryDb();
    const result = canStartPipeline(db, LOCK_FILE);
    expect(result.allowed).toBe(true);
  });

  it('canStartPipeline should return allowed=false with reason when lock is held', () => {
    const db = makeInMemoryDb();
    acquireLock('run-005', LOCK_FILE);
    const result = canStartPipeline(db, LOCK_FILE);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/lock|running/i);
  });

  it('canStartPipeline should return allowed=false when a run is active in SQLite', () => {
    const db = makeInMemoryDb();
    db.prepare(
      "INSERT INTO pipeline_runs (id, status, started_at) VALUES (?, 'running', ?)",
    ).run('run-active', new Date().toISOString());

    const result = canStartPipeline(db, LOCK_FILE);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/running/i);
  });
});
