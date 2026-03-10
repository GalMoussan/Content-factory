import type Database from 'better-sqlite3';

export interface CircuitBreakerState {
  readonly id: number;
  readonly status: string;
  readonly consecutiveFailures: number;
  readonly lastFailureAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly openedAt: string | null;
}

export interface UpdateCircuitBreakerInput {
  readonly status?: string;
  readonly consecutiveFailures?: number;
  readonly lastFailureAt?: string;
  readonly lastSuccessAt?: string;
  readonly openedAt?: string;
}

interface CircuitBreakerRow {
  id: number;
  status: string;
  consecutive_failures: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  opened_at: string | null;
}

function rowToModel(row: CircuitBreakerRow): CircuitBreakerState {
  return {
    id: row.id,
    status: row.status,
    consecutiveFailures: row.consecutive_failures,
    lastFailureAt: row.last_failure_at,
    lastSuccessAt: row.last_success_at,
    openedAt: row.opened_at,
  };
}

export function getCircuitBreakerState(
  db: Database.Database,
): CircuitBreakerState {
  const row = db
    .prepare('SELECT * FROM circuit_breaker WHERE id = 1')
    .get() as CircuitBreakerRow;
  return rowToModel(row);
}

export function updateCircuitBreakerState(
  db: Database.Database,
  updates: UpdateCircuitBreakerInput,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.consecutiveFailures !== undefined) {
    fields.push('consecutive_failures = ?');
    values.push(updates.consecutiveFailures);
  }
  if (updates.lastFailureAt !== undefined) {
    fields.push('last_failure_at = ?');
    values.push(updates.lastFailureAt);
  }
  if (updates.lastSuccessAt !== undefined) {
    fields.push('last_success_at = ?');
    values.push(updates.lastSuccessAt);
  }
  if (updates.openedAt !== undefined) {
    fields.push('opened_at = ?');
    values.push(updates.openedAt);
  }

  if (fields.length === 0) return;

  db.prepare(`UPDATE circuit_breaker SET ${fields.join(', ')} WHERE id = 1`).run(
    ...values,
  );
}

export function initCircuitBreaker(db: Database.Database): void {
  db.prepare(
    `INSERT OR IGNORE INTO circuit_breaker (id) VALUES (1)`,
  ).run();
}
