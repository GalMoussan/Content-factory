import type Database from 'better-sqlite3';

export interface CreatePipelineRunInput {
  readonly id: string;
  readonly triggeredBy: string;
  readonly startedAt: string;
}

export interface UpdatePipelineRunInput {
  readonly status?: string;
  readonly completedAt?: string;
  readonly error?: string;
}

export interface PipelineRun {
  readonly id: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly triggeredBy: string;
  readonly error: string | null;
}

interface PipelineRunRow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  triggered_by: string;
  error: string | null;
}

function rowToModel(row: PipelineRunRow): PipelineRun {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    triggeredBy: row.triggered_by,
    error: row.error,
  };
}

export function createPipelineRun(
  db: Database.Database,
  input: CreatePipelineRunInput,
): void {
  db.prepare(
    `INSERT INTO pipeline_runs (id, status, started_at, triggered_by)
     VALUES (?, 'running', ?, ?)`,
  ).run(input.id, input.startedAt, input.triggeredBy);
}

export function getPipelineRun(
  db: Database.Database,
  id: string,
): PipelineRun | undefined {
  const row = db
    .prepare('SELECT * FROM pipeline_runs WHERE id = ?')
    .get(id) as PipelineRunRow | undefined;
  return row ? rowToModel(row) : undefined;
}

export function updatePipelineRunStatus(
  db: Database.Database,
  id: string,
  updates: UpdatePipelineRunInput,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE pipeline_runs SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  );
}

export function listPipelineRuns(
  db: Database.Database,
  options?: { limit?: number; offset?: number },
): readonly PipelineRun[] {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const rows = db
    .prepare('SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as PipelineRunRow[];
  return rows.map(rowToModel);
}
