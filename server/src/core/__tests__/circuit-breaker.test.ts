import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  resetCircuitBreaker,
  getCircuitBreakerState,
  CircuitState,
} from '../circuit-breaker';

// T014 — Circuit Breaker System
// Tests will fail at import until circuit-breaker.ts is implemented.

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
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

describe('T014 — Circuit Breaker System', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
  });

  // Acceptance: "Opens after 3 consecutive failures"
  it('should remain CLOSED after fewer than 3 consecutive failures', () => {
    recordFailure(db);
    recordFailure(db);
    expect(isCircuitOpen(db)).toBe(false);
    expect(getCircuitBreakerState(db).state).toBe(CircuitState.CLOSED);
  });

  it('should transition to OPEN after 3 consecutive failures', () => {
    recordFailure(db);
    recordFailure(db);
    recordFailure(db);
    expect(isCircuitOpen(db)).toBe(true);
    expect(getCircuitBreakerState(db).state).toBe(CircuitState.OPEN);
  });

  // Acceptance: "recordSuccess resets consecutive failures and closes circuit"
  it('should reset to CLOSED and clear failures on success', () => {
    recordFailure(db);
    recordFailure(db);
    recordSuccess(db);
    const state = getCircuitBreakerState(db);
    expect(state.state).toBe(CircuitState.CLOSED);
    expect(state.consecutiveFailures).toBe(0);
  });

  // Acceptance: "Manual reset via resetCircuitBreaker function"
  it('should allow manual reset to CLOSED from OPEN state', () => {
    recordFailure(db);
    recordFailure(db);
    recordFailure(db);
    expect(isCircuitOpen(db)).toBe(true);

    resetCircuitBreaker(db);
    expect(isCircuitOpen(db)).toBe(false);
    expect(getCircuitBreakerState(db).state).toBe(CircuitState.CLOSED);
  });

  // Acceptance: "Half-open state allows exactly 1 test run"
  it('should transition to HALF_OPEN after cooldown period has elapsed', () => {
    recordFailure(db);
    recordFailure(db);
    recordFailure(db);

    // Simulate cooldown elapsed by back-dating opened_at
    const pastTime = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    db.prepare('UPDATE circuit_breaker SET opened_at = ? WHERE id = 1').run(pastTime);

    const state = getCircuitBreakerState(db);
    expect(state.state).toBe(CircuitState.HALF_OPEN);
  });

  it('should close the circuit when the half-open test run succeeds', () => {
    recordFailure(db);
    recordFailure(db);
    recordFailure(db);

    const pastTime = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    db.prepare('UPDATE circuit_breaker SET opened_at = ? WHERE id = 1').run(pastTime);

    recordSuccess(db);
    expect(getCircuitBreakerState(db).state).toBe(CircuitState.CLOSED);
  });

  it('should reopen the circuit when the half-open test run fails', () => {
    recordFailure(db);
    recordFailure(db);
    recordFailure(db);

    const pastTime = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    db.prepare('UPDATE circuit_breaker SET opened_at = ? WHERE id = 1').run(pastTime);

    recordFailure(db);
    expect(getCircuitBreakerState(db).state).toBe(CircuitState.OPEN);
  });

  // Acceptance: "Circuit breaker state stored in SQLite (survives process restart)"
  it('should persist state in SQLite so a new DB connection sees the same state', () => {
    const dbFile = require('node:path').join(
      require('node:os').tmpdir(),
      `cb-test-${Date.now()}.db`,
    );
    const persistent = new Database(dbFile);
    persistent.exec(`
      CREATE TABLE circuit_breaker (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL DEFAULT 'CLOSED',
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        opened_at TEXT,
        last_failure_at TEXT
      );
      INSERT INTO circuit_breaker (id) VALUES (1);
    `);

    recordFailure(persistent);
    recordFailure(persistent);
    recordFailure(persistent);
    persistent.close();

    // Re-open same file — simulates a process restart
    const reopened = new Database(dbFile);
    expect(isCircuitOpen(reopened)).toBe(true);
    reopened.close();

    require('node:fs').unlinkSync(dbFile);
  });
});
