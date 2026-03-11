import type Database from 'better-sqlite3';
import { isCircuitOpen } from './circuit-breaker.js';
import { isLocked } from './pipeline-lock.js';

interface GuardResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Combined guard: checks circuit breaker, lock file, and SQLite for running pipelines.
 */
export function canStartPipeline(db: Database.Database, lockFile: string): GuardResult {
  // 1. Check circuit breaker
  if (isCircuitOpen(db)) {
    return { allowed: false, reason: 'Circuit breaker is open' };
  }

  // 2. Check lock file
  if (isLocked(lockFile)) {
    return { allowed: false, reason: 'Pipeline lock is held — another run is in progress' };
  }

  // 3. Check SQLite for running pipeline runs
  const running = db
    .prepare("SELECT COUNT(*) as count FROM pipeline_runs WHERE status = 'running'")
    .get() as { count: number };

  if (running.count > 0) {
    return { allowed: false, reason: 'A pipeline run is currently running in SQLite' };
  }

  return { allowed: true };
}
