import type Database from 'better-sqlite3';

export interface CreateAgentExecutionInput {
  readonly runId: string;
  readonly agentName: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly outputFile?: string;
  readonly error?: string;
  readonly metricsJson?: string;
}

export interface UpdateAgentExecutionInput {
  readonly status?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly outputFile?: string;
  readonly error?: string;
  readonly metricsJson?: string;
}

export interface AgentExecution {
  readonly id: number;
  readonly runId: string;
  readonly agentName: string;
  readonly status: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly outputFile: string | null;
  readonly error: string | null;
  readonly metricsJson: string | null;
}

interface AgentExecutionRow {
  id: number;
  run_id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  output_file: string | null;
  error: string | null;
  metrics_json: string | null;
}

function rowToModel(row: AgentExecutionRow): AgentExecution {
  return {
    id: row.id,
    runId: row.run_id,
    agentName: row.agent_name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    outputFile: row.output_file,
    error: row.error,
    metricsJson: row.metrics_json,
  };
}

export function createAgentExecution(
  db: Database.Database,
  input: CreateAgentExecutionInput,
): void {
  db.prepare(
    `INSERT INTO agent_executions (run_id, agent_name, status, started_at, completed_at, duration_ms, output_file, error, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.runId,
    input.agentName,
    input.status,
    input.startedAt,
    input.completedAt ?? null,
    input.durationMs ?? null,
    input.outputFile ?? null,
    input.error ?? null,
    input.metricsJson ?? null,
  );
}

export function getAgentExecutionsForRun(
  db: Database.Database,
  runId: string,
): readonly AgentExecution[] {
  const rows = db
    .prepare('SELECT * FROM agent_executions WHERE run_id = ? ORDER BY started_at ASC')
    .all(runId) as AgentExecutionRow[];
  return rows.map(rowToModel);
}

export function updateAgentExecution(
  db: Database.Database,
  id: number,
  updates: UpdateAgentExecutionInput,
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
  if (updates.durationMs !== undefined) {
    fields.push('duration_ms = ?');
    values.push(updates.durationMs);
  }
  if (updates.outputFile !== undefined) {
    fields.push('output_file = ?');
    values.push(updates.outputFile);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }
  if (updates.metricsJson !== undefined) {
    fields.push('metrics_json = ?');
    values.push(updates.metricsJson);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE agent_executions SET ${fields.join(', ')} WHERE id = ?`).run(
    ...values,
  );
}
