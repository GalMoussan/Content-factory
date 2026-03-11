import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import type { PipelineEventEmitter } from '../services/event-emitter.js';

const AGENT_SEQUENCE = [
  'TrendScout',
  'ResearchCrawler',
  'ContentProducer',
  'QualityController',
  'Publisher',
] as const;

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes per agent (video rendering is slow)

interface ExecutePipelineDeps {
  readonly db: Database.Database;
  readonly emitter: PipelineEventEmitter;
  readonly agents: Record<string, (ctx: { runDir: string }) => Promise<void>>;
  readonly agentTimeouts?: Record<string, number>;
}

/**
 * Execute the full pipeline: run all 5 agents in sequence.
 * Records status in SQLite and emits SSE events.
 */
export async function executePipeline(
  runId: string,
  deps: ExecutePipelineDeps,
): Promise<void> {
  const { db, emitter, agents, agentTimeouts } = deps;
  const runDir = path.join(os.tmpdir(), runId);

  // Create run directory and _meta.json
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    path.join(runDir, '_meta.json'),
    JSON.stringify({ runId, startedAt: new Date().toISOString() }),
    'utf8',
  );

  // Record pipeline start in SQLite
  db.prepare(
    "INSERT INTO pipeline_runs (id, status, started_at) VALUES (?, 'running', ?)",
  ).run(runId, new Date().toISOString());

  // Emit pipeline started event
  emitter.broadcast({ type: 'pipeline:started', data: { runId } });

  try {
    for (const agentName of AGENT_SEQUENCE) {
      const agentFn = agents[agentName];
      if (!agentFn) {
        throw new Error(`Agent not found: ${agentName}`);
      }

      emitter.broadcast({ type: 'agent:started', data: { runId, agentName } });

      const timeout = agentTimeouts?.[agentName] ?? DEFAULT_TIMEOUT_MS;

      // Run agent with timeout
      await runWithTimeout(
        () => agentFn({ runDir }),
        timeout,
        agentName,
      );

      emitter.broadcast({ type: 'agent:completed', data: { runId, agentName } });
    }

    // Pipeline completed successfully
    db.prepare(
      'UPDATE pipeline_runs SET status = ?, completed_at = ? WHERE id = ?',
    ).run('completed', new Date().toISOString(), runId);

    emitter.broadcast({ type: 'pipeline:completed', data: { runId } });
  } catch (err) {
    // Determine which agent failed
    const failedAgent = findFailedAgent(err);

    db.prepare(
      'UPDATE pipeline_runs SET status = ?, failed_agent = ?, completed_at = ? WHERE id = ?',
    ).run('failed', failedAgent, new Date().toISOString(), runId);

    emitter.broadcast({ type: 'pipeline:failed', data: { runId, failedAgent, error: (err as Error).message } });

    throw err;
  } finally {
    // Clean up run directory
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function runWithTimeout(
  fn: () => Promise<void>,
  timeoutMs: number,
  agentName: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AgentTimeoutError(`Agent ${agentName} timeout after ${timeoutMs}ms`, agentName));
    }, timeoutMs);

    fn()
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((err) => {
        clearTimeout(timer);
        if (err instanceof Error) {
          (err as AgentTimeoutError)._agentName = agentName;
        }
        reject(err);
      });
  });
}

class AgentTimeoutError extends Error {
  _agentName: string;
  constructor(message: string, agentName: string) {
    super(message);
    this.name = 'AgentTimeoutError';
    this._agentName = agentName;
  }
}

function findFailedAgent(err: unknown): string {
  if (err instanceof AgentTimeoutError) return err._agentName;
  if (err instanceof Error && '_agentName' in err) return (err as AgentTimeoutError)._agentName;
  return 'unknown';
}
