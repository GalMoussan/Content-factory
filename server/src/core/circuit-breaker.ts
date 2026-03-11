import type Database from 'better-sqlite3';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes

interface CircuitBreakerRow {
  state: string;
  consecutive_failures: number;
  opened_at: string | null;
  last_failure_at: string | null;
}

export interface CircuitBreakerState {
  readonly state: CircuitState;
  readonly consecutiveFailures: number;
  readonly openedAt: string | null;
  readonly lastFailureAt: string | null;
}

function getRow(db: Database.Database): CircuitBreakerRow {
  return db.prepare('SELECT state, consecutive_failures, opened_at, last_failure_at FROM circuit_breaker WHERE id = 1').get() as CircuitBreakerRow;
}

/**
 * Check if the circuit breaker is currently open (blocking pipeline runs).
 */
export function isCircuitOpen(db: Database.Database): boolean {
  const row = getRow(db);
  if (row.state === CircuitState.CLOSED) return false;
  if (row.state === CircuitState.OPEN) {
    // Check if cooldown has elapsed → half-open
    if (row.opened_at) {
      const elapsed = Date.now() - new Date(row.opened_at).getTime();
      if (elapsed >= COOLDOWN_MS) {
        return false; // half-open — allow one test run
      }
    }
    return true;
  }
  return false;
}

/**
 * Record a successful pipeline run — reset failures and close circuit.
 */
export function recordSuccess(db: Database.Database): void {
  db.prepare(
    'UPDATE circuit_breaker SET state = ?, consecutive_failures = 0, opened_at = NULL, last_failure_at = NULL WHERE id = 1',
  ).run(CircuitState.CLOSED);
}

/**
 * Record a pipeline failure — increment failures, potentially open circuit.
 */
export function recordFailure(db: Database.Database): void {
  const row = getRow(db);
  const newFailures = row.consecutive_failures + 1;
  const now = new Date().toISOString();

  if (newFailures >= FAILURE_THRESHOLD) {
    db.prepare(
      'UPDATE circuit_breaker SET state = ?, consecutive_failures = ?, opened_at = ?, last_failure_at = ? WHERE id = 1',
    ).run(CircuitState.OPEN, newFailures, now, now);
  } else {
    db.prepare(
      'UPDATE circuit_breaker SET consecutive_failures = ?, last_failure_at = ? WHERE id = 1',
    ).run(newFailures, now);
  }
}

/**
 * Manual reset — force circuit to CLOSED state.
 */
export function resetCircuitBreaker(db: Database.Database): void {
  db.prepare(
    'UPDATE circuit_breaker SET state = ?, consecutive_failures = 0, opened_at = NULL, last_failure_at = NULL WHERE id = 1',
  ).run(CircuitState.CLOSED);
}

/**
 * Get the current circuit breaker state for the dashboard.
 */
export function getCircuitBreakerState(db: Database.Database): CircuitBreakerState {
  const row = getRow(db);

  // Determine effective state (check for half-open)
  let effectiveState = row.state as CircuitState;
  if (effectiveState === CircuitState.OPEN && row.opened_at) {
    const elapsed = Date.now() - new Date(row.opened_at).getTime();
    if (elapsed >= COOLDOWN_MS) {
      effectiveState = CircuitState.HALF_OPEN;
    }
  }

  return {
    state: effectiveState,
    consecutiveFailures: row.consecutive_failures,
    openedAt: row.opened_at,
    lastFailureAt: row.last_failure_at,
  };
}
