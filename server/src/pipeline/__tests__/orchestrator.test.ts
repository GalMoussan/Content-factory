import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { executePipeline } from '../orchestrator';
import { PipelineEventEmitter } from '../../services/event-emitter';

// T012 — Pipeline Orchestrator
// Tests will fail at import until orchestrator.ts is implemented.

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      failed_agent TEXT,
      trigger TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT
    );
  `);
  return db;
}

function makeEmitter() {
  return {
    broadcast: vi.fn(),
    addClient: vi.fn(),
    removeClient: vi.fn(),
  } as unknown as PipelineEventEmitter;
}

const AGENT_NAMES = [
  'TrendScout',
  'ResearchCrawler',
  'ContentProducer',
  'QualityController',
  'Publisher',
];

describe('T012 — Pipeline Orchestrator', () => {
  let db: Database.Database;
  let emitter: PipelineEventEmitter;

  beforeEach(() => {
    db = makeInMemoryDb();
    emitter = makeEmitter();
  });

  // Acceptance: "Runs all 5 agents in correct sequence"
  it('should execute all 5 agents in the correct sequence', async () => {
    const executionOrder: string[] = [];
    const mockAgents = AGENT_NAMES.reduce<Record<string, () => Promise<void>>>(
      (acc, name) => ({
        ...acc,
        [name]: vi.fn(async () => {
          executionOrder.push(name);
        }),
      }),
      {},
    );

    const runId = 'run-001';
    await executePipeline(runId, { db, emitter, agents: mockAgents });

    expect(executionOrder).toEqual(AGENT_NAMES);
  });

  // Acceptance: "Records pipeline run status in SQLite (running → completed)"
  it('should persist run status as running then completed in SQLite', async () => {
    const runId = 'run-002';
    const mockAgents = AGENT_NAMES.reduce<Record<string, () => Promise<void>>>(
      (acc, name) => ({ ...acc, [name]: vi.fn(async () => {}) }),
      {},
    );

    await executePipeline(runId, { db, emitter, agents: mockAgents });

    const row = db
      .prepare('SELECT status FROM pipeline_runs WHERE id = ?')
      .get(runId) as { status: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.status).toBe('completed');
  });

  // Acceptance: "Stops pipeline on first agent failure"
  it('should stop execution and mark run as failed when an agent throws', async () => {
    const executionOrder: string[] = [];
    const mockAgents = {
      TrendScout: vi.fn(async () => { executionOrder.push('TrendScout'); }),
      ResearchCrawler: vi.fn(async () => {
        executionOrder.push('ResearchCrawler');
        throw new Error('Crawl failed');
      }),
      ContentProducer: vi.fn(async () => { executionOrder.push('ContentProducer'); }),
      QualityController: vi.fn(async () => { executionOrder.push('QualityController'); }),
      Publisher: vi.fn(async () => { executionOrder.push('Publisher'); }),
    };

    const runId = 'run-003';
    await expect(
      executePipeline(runId, { db, emitter, agents: mockAgents }),
    ).rejects.toThrow();

    // Agents after the failure must NOT have been called
    expect(executionOrder).toEqual(['TrendScout', 'ResearchCrawler']);
    expect(mockAgents.ContentProducer).not.toHaveBeenCalled();

    const row = db
      .prepare('SELECT status, failed_agent FROM pipeline_runs WHERE id = ?')
      .get(runId) as { status: string; failed_agent: string } | undefined;

    expect(row!.status).toBe('failed');
    expect(row!.failed_agent).toBe('ResearchCrawler');
  });

  // Acceptance: "SSE events emitted for pipeline start/complete and each agent"
  it('should emit pipeline:started and pipeline:completed SSE events', async () => {
    const runId = 'run-004';
    const mockAgents = AGENT_NAMES.reduce<Record<string, () => Promise<void>>>(
      (acc, name) => ({ ...acc, [name]: vi.fn(async () => {}) }),
      {},
    );

    await executePipeline(runId, { db, emitter, agents: mockAgents });

    const broadcastCalls = (emitter.broadcast as ReturnType<typeof vi.fn>).mock.calls.map(
      ([evt]: [{ type: string }]) => evt.type,
    );

    expect(broadcastCalls).toContain('pipeline:started');
    expect(broadcastCalls).toContain('pipeline:completed');
  });

  // Acceptance: "Creates run directory with _meta.json before starting"
  it('should create _meta.json run directory entry before executing agents', async () => {
    const runId = 'run-005';
    let metaCreatedBeforeFirstAgent = false;
    const fs = await import('node:fs');

    const mockAgents = {
      TrendScout: vi.fn(async ({ runDir }: { runDir: string }) => {
        metaCreatedBeforeFirstAgent = fs.existsSync(`${runDir}/_meta.json`);
      }),
      ResearchCrawler: vi.fn(async () => {}),
      ContentProducer: vi.fn(async () => {}),
      QualityController: vi.fn(async () => {}),
      Publisher: vi.fn(async () => {}),
    };

    await executePipeline(runId, { db, emitter, agents: mockAgents });

    expect(metaCreatedBeforeFirstAgent).toBe(true);
  });

  // Acceptance: "Per-agent timeouts enforced via runAgentWithTimeout"
  it('should reject the pipeline when an agent exceeds its timeout', async () => {
    const runId = 'run-006';
    const mockAgents = {
      TrendScout: vi.fn(
        async () => new Promise<void>((resolve) => setTimeout(resolve, 60_000)),
      ),
      ResearchCrawler: vi.fn(async () => {}),
      ContentProducer: vi.fn(async () => {}),
      QualityController: vi.fn(async () => {}),
      Publisher: vi.fn(async () => {}),
    };

    // Pass a very short timeout so the test does not actually wait 60 s
    await expect(
      executePipeline(runId, {
        db,
        emitter,
        agents: mockAgents,
        agentTimeouts: { TrendScout: 50 },
      }),
    ).rejects.toThrow(/timeout/i);
  });
});
