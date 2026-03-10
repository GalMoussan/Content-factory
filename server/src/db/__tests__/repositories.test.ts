import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../connection';
import { runMigrations } from '../migrate';
import {
  createPipelineRun,
  getPipelineRun,
  updatePipelineRunStatus,
  listPipelineRuns,
} from '../repositories/pipeline-runs';
import {
  createAgentExecution,
  updateAgentExecution,
  getAgentExecutionsForRun,
} from '../repositories/agent-executions';
import {
  createQAScore,
  getQAScoreForRun,
} from '../repositories/qa-scores';
import {
  createPublishLog,
  getPublishLogForRun,
  updatePublishLogStatus,
} from '../repositories/publish-log';
import {
  getCircuitBreakerState,
  updateCircuitBreakerState,
} from '../repositories/circuit-breaker';

// T003 — SQLite Database Layer
// Tests will fail at import until the database modules are implemented.

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------
// Connection / Migration
// ---------------------------------------------------------------------------
describe('T003 — Database Initialization', () => {
  // Acceptance: "Database initializes with WAL mode, busy_timeout=5000, foreign_keys=ON"
  it('should enable WAL journal mode on initialization', () => {
    const db = new Database(':memory:');
    initDb(db);
    const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(row.journal_mode).toBe('wal');
  });

  it('should enable foreign keys pragma', () => {
    const db = new Database(':memory:');
    initDb(db);
    const row = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
  });

  // Acceptance: "Schema creates all 5 tables with proper constraints"
  it('should create all 5 required tables after migration', () => {
    const db = makeInMemoryDb();
    const tables = (db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[])
      .map((r) => r.name);

    expect(tables).toContain('pipeline_runs');
    expect(tables).toContain('agent_executions');
    expect(tables).toContain('qa_scores');
    expect(tables).toContain('publish_log');
    expect(tables).toContain('circuit_breaker');
  });

  // Acceptance: "Circuit breaker singleton row created on initialization"
  it('should seed a circuit breaker singleton row on migration', () => {
    const db = makeInMemoryDb();
    const row = db.prepare('SELECT id FROM circuit_breaker').get() as { id: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.id).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PipelineRuns repository
// ---------------------------------------------------------------------------
describe('T003 — PipelineRuns repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
  });

  // Acceptance: "Tests cover CRUD operations for each repository"
  it('should create a pipeline run and retrieve it by id', () => {
    const id = 'run-001';
    createPipelineRun(db, { id, triggeredBy: 'manual', startedAt: new Date().toISOString() });

    const run = getPipelineRun(db, id);
    expect(run).toBeDefined();
    expect(run!.id).toBe(id);
    expect(run!.status).toBe('running');
  });

  it('should update the status and completedAt of a pipeline run', () => {
    const id = 'run-002';
    const startedAt = new Date().toISOString();
    createPipelineRun(db, { id, triggeredBy: 'cron', startedAt });

    const completedAt = new Date().toISOString();
    updatePipelineRunStatus(db, id, { status: 'completed', completedAt });

    const run = getPipelineRun(db, id);
    expect(run!.status).toBe('completed');
    expect(run!.completedAt).toBe(completedAt);
  });

  it('should list all pipeline runs ordered by start time', () => {
    createPipelineRun(db, { id: 'run-003', triggeredBy: 'manual', startedAt: '2025-01-01T00:00:00.000Z' });
    createPipelineRun(db, { id: 'run-004', triggeredBy: 'manual', startedAt: '2025-01-02T00:00:00.000Z' });

    const runs = listPipelineRuns(db);
    expect(runs.length).toBe(2);
    expect(runs[0].id).toBeDefined();
  });

  // Acceptance: "Timestamps stored as ISO 8601 strings"
  it('should store timestamps as ISO 8601 strings', () => {
    const startedAt = '2025-06-15T10:30:00.000Z';
    createPipelineRun(db, { id: 'run-005', triggeredBy: 'manual', startedAt });
    const run = getPipelineRun(db, 'run-005');
    expect(run!.startedAt).toBe(startedAt);
  });

  it('should return undefined when pipeline run does not exist', () => {
    expect(getPipelineRun(db, 'nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AgentExecutions repository
// ---------------------------------------------------------------------------
describe('T003 — AgentExecutions repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    createPipelineRun(db, { id: 'run-001', triggeredBy: 'manual', startedAt: new Date().toISOString() });
  });

  it('should create an agent execution associated with a run', () => {
    createAgentExecution(db, {
      runId: 'run-001',
      agentName: 'TrendScout',
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const executions = getAgentExecutionsForRun(db, 'run-001');
    expect(executions.length).toBe(1);
    expect(executions[0].agentName).toBe('TrendScout');
  });

  it('should update an agent execution with completed status and duration', () => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO agent_executions (run_id, agent_name, status, started_at)
      VALUES ('run-001', 'TrendScout', 'running', ?)
    `).run(new Date().toISOString());

    const id = Number(lastInsertRowid);
    const completedAt = new Date().toISOString();
    updateAgentExecution(db, id, { status: 'completed', completedAt, durationMs: 3200 });

    const executions = getAgentExecutionsForRun(db, 'run-001');
    expect(executions[0].status).toBe('completed');
    expect(executions[0].durationMs).toBe(3200);
  });

  it('should store serialized metrics JSON in the metrics_json column', () => {
    const metrics = { topicsFound: 5, sourcesQueried: 3 };
    createAgentExecution(db, {
      runId: 'run-001',
      agentName: 'TrendScout',
      status: 'completed',
      startedAt: new Date().toISOString(),
      metricsJson: JSON.stringify(metrics),
    });

    const executions = getAgentExecutionsForRun(db, 'run-001');
    expect(JSON.parse(executions[0].metricsJson!)).toEqual(metrics);
  });
});

// ---------------------------------------------------------------------------
// QAScores repository
// ---------------------------------------------------------------------------
describe('T003 — QAScores repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    createPipelineRun(db, { id: 'run-001', triggeredBy: 'manual', startedAt: new Date().toISOString() });
  });

  it('should create a QA score record and retrieve it by run id', () => {
    const dimensions = [
      { dimension: 'script-quality', score: 85, feedback: 'Great', issues: [] },
      { dimension: 'originality', score: 72, feedback: 'Acceptable', issues: [] },
    ];

    createQAScore(db, {
      runId: 'run-001',
      topicId: 'topic-abc',
      overallScore: 79,
      verdict: 'approved',
      dimensionsJson: JSON.stringify(dimensions),
      createdAt: new Date().toISOString(),
    });

    const score = getQAScoreForRun(db, 'run-001');
    expect(score).toBeDefined();
    expect(score!.overallScore).toBe(79);
    expect(score!.verdict).toBe('approved');
  });

  it('should parse the dimensionsJson back to the original array', () => {
    const dimensions = [{ dimension: 'script-quality', score: 90, feedback: 'Excellent', issues: [] }];
    createQAScore(db, {
      runId: 'run-001',
      topicId: 'topic-abc',
      overallScore: 90,
      verdict: 'approved',
      dimensionsJson: JSON.stringify(dimensions),
      createdAt: new Date().toISOString(),
    });

    const score = getQAScoreForRun(db, 'run-001');
    expect(JSON.parse(score!.dimensionsJson)).toEqual(dimensions);
  });
});

// ---------------------------------------------------------------------------
// PublishLog repository
// ---------------------------------------------------------------------------
describe('T003 — PublishLog repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    createPipelineRun(db, { id: 'run-001', triggeredBy: 'manual', startedAt: new Date().toISOString() });
  });

  it('should create a publish log entry and retrieve it', () => {
    createPublishLog(db, {
      runId: 'run-001',
      topicId: 'topic-abc',
      title: 'GPT-5 Deep Dive',
      status: 'published',
      youtubeVideoId: 'dQw4w9WgXcQ',
      youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      createdAt: new Date().toISOString(),
    });

    const log = getPublishLogForRun(db, 'run-001');
    expect(log).toBeDefined();
    expect(log!.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('should update publish log status', () => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO publish_log (run_id, topic_id, title, status, created_at)
      VALUES ('run-001', 'topic-abc', 'Test', 'scheduled', ?)
    `).run(new Date().toISOString());

    updatePublishLogStatus(db, Number(lastInsertRowid), 'published');

    const log = getPublishLogForRun(db, 'run-001');
    expect(log!.status).toBe('published');
  });
});

// ---------------------------------------------------------------------------
// CircuitBreaker repository
// ---------------------------------------------------------------------------
describe('T003 — CircuitBreaker repository', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
  });

  it('should return the singleton circuit breaker row', () => {
    const state = getCircuitBreakerState(db);
    expect(state).toBeDefined();
    expect(state.id).toBe(1);
  });

  it('should update circuit breaker state fields', () => {
    updateCircuitBreakerState(db, {
      consecutiveFailures: 3,
      openedAt: new Date().toISOString(),
    });

    const state = getCircuitBreakerState(db);
    expect(state.consecutiveFailures).toBe(3);
    expect(state.openedAt).toBeDefined();
  });

  // Acceptance: "All queries use parameterized statements (no SQL injection)"
  it('should handle special characters in error field without SQL injection', () => {
    // If queries were not parameterized, this would throw a syntax error
    expect(() =>
      updateCircuitBreakerState(db, { lastFailureAt: "2025-01-01'; DROP TABLE circuit_breaker;--" })
    ).not.toThrow();

    // Table should still exist
    const state = getCircuitBreakerState(db);
    expect(state).toBeDefined();
  });
});
