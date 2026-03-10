import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { BaseAgent } from '../base-agent';
import { runAgentWithTimeout } from '../agent-runner';
import type { AgentContext, AgentResult } from '@shared/types/agent';

// T005 — Agent Base Class and Lifecycle
// Tests will fail at import until base-agent.ts and agent-runner.ts are implemented.

// ---------------------------------------------------------------------------
// Helpers / Fixtures
// ---------------------------------------------------------------------------

const InputSchema = z.object({ topic: z.string() });
const OutputSchema = z.object({ result: z.string(), score: z.number() });

type Input = z.infer<typeof InputSchema>;
type Output = z.infer<typeof OutputSchema>;

/**
 * Minimal concrete implementation for testing the abstract BaseAgent.
 */
class MockAgent extends BaseAgent<Input, Output> {
  public readonly inputSchema = InputSchema;
  public readonly outputSchema = OutputSchema;
  public processFn: (input: Input, ctx: AgentContext) => Promise<Output>;

  constructor(processFn: (input: Input, ctx: AgentContext) => Promise<Output>) {
    super({
      name: 'MockAgent',
      inputFile: 'input.json',
      outputFile: 'output.json',
    });
    this.processFn = processFn;
  }

  protected async process(input: Input, ctx: AgentContext): Promise<Output> {
    return this.processFn(input, ctx);
  }
}

/**
 * A no-input agent (like TrendScout) that has inputFile: null.
 */
class NoInputMockAgent extends BaseAgent<null, Output> {
  public readonly inputSchema = z.null();
  public readonly outputSchema = OutputSchema;

  constructor() {
    super({
      name: 'NoInputMockAgent',
      inputFile: null,
      outputFile: 'output.json',
    });
  }

  protected async process(_input: null, _ctx: AgentContext): Promise<Output> {
    return { result: 'discovered', score: 90 };
  }
}

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE pipeline_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      triggered_by TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      output_file TEXT,
      error TEXT,
      metrics_json TEXT
    );
    INSERT INTO pipeline_runs (id, status, started_at) VALUES ('run-test', 'running', '${new Date().toISOString()}');
  `);
  return db;
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    runId: 'run-test',
    runDir: '/tmp/run-test',
    db: makeDb(),
    emitter: { broadcast: vi.fn() } as any,
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Agent lifecycle
// ---------------------------------------------------------------------------
describe('T005 — BaseAgent lifecycle', () => {
  // Acceptance: "Input validation skipped when inputFile is null (TrendScout)"
  it('should skip input reading and validation when inputFile is null', async () => {
    const agent = new NoInputMockAgent();
    const ctx = makeCtx();

    // No input.json in runDir — if it tried to read one, it would throw
    const result = await agent.execute(ctx);
    expect(result.success).toBe(true);
  });

  // Acceptance: "BaseAgent follows the lifecycle from system design Section 3"
  it('should call process() and return a successful AgentResult', async () => {
    const processFn = vi.fn(async (_input: Input, _ctx: AgentContext): Promise<Output> => ({
      result: 'done',
      score: 80,
    }));

    const agent = new MockAgent(processFn);
    const ctx = makeCtx();

    // Write a valid input file that the agent can read
    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.runDir, 'input.json'), JSON.stringify({ topic: 'GPT-5' }));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(true);
    expect(processFn).toHaveBeenCalledOnce();

    // Cleanup
    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });

  // Acceptance: "Execution recorded in SQLite agent_executions table"
  it('should record execution in the agent_executions table', async () => {
    const agent = new NoInputMockAgent();
    const ctx = makeCtx();

    await agent.execute(ctx);

    const row = ctx.db
      .prepare('SELECT * FROM agent_executions WHERE run_id = ? AND agent_name = ?')
      .get('run-test', 'NoInputMockAgent') as { status: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.status).toBe('completed');
  });

  // Acceptance: "SSE events emitted at agent start and completion"
  it('should emit agent:started and agent:completed SSE events', async () => {
    const agent = new NoInputMockAgent();
    const ctx = makeCtx();

    await agent.execute(ctx);

    const broadcastCalls = (ctx.emitter.broadcast as ReturnType<typeof vi.fn>).mock.calls.map(
      ([evt]: [{ type: string }]) => evt.type,
    );

    expect(broadcastCalls).toContain('agent:started');
    expect(broadcastCalls).toContain('agent:completed');
  });

  // Acceptance: "Output validated before writing to queue"
  it('should throw and record failure when process() returns invalid output', async () => {
    const processFn = vi.fn(async (): Promise<any> => ({
      result: 'done',
      score: 'not-a-number', // invalid — violates OutputSchema
    }));

    const agent = new MockAgent(processFn);
    const ctx = makeCtx();

    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.runDir, 'input.json'), JSON.stringify({ topic: 'GPT-5' }));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });

  it('should propagate process() errors as failed AgentResult', async () => {
    const processFn = vi.fn(async (): Promise<Output> => {
      throw new Error('External API unavailable');
    });

    const agent = new MockAgent(processFn);
    const ctx = makeCtx();

    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.runDir, 'input.json'), JSON.stringify({ topic: 'GPT-5' }));

    const result = await agent.execute(ctx);
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('External API unavailable');

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });

  it('should fail fast with an error result when input file is missing', async () => {
    const processFn = vi.fn(async (_: Input, __: AgentContext): Promise<Output> => ({ result: 'x', score: 0 }));
    const agent = new MockAgent(processFn);
    const ctx = makeCtx({ runDir: '/nonexistent-run-dir-xyz' });

    const result = await agent.execute(ctx);
    expect(result.success).toBe(false);
    expect(processFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Agent runner — timeout
// ---------------------------------------------------------------------------
describe('T005 — runAgentWithTimeout', () => {
  // Acceptance: "runAgentWithTimeout properly aborts on timeout"
  it('should resolve successfully when the agent completes within the timeout', async () => {
    const agent = new NoInputMockAgent();
    const ctx = makeCtx();

    const result = await runAgentWithTimeout(agent, ctx, 5000);
    expect(result.success).toBe(true);
  });

  it('should return a failed AgentResult with timeout error when the agent exceeds the limit', async () => {
    const slowProcessFn = vi.fn(
      (_: Input, __: AgentContext): Promise<Output> =>
        new Promise((resolve) => setTimeout(() => resolve({ result: 'late', score: 0 }), 60_000)),
    );
    const agent = new MockAgent(slowProcessFn);
    const ctx = makeCtx();

    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.runDir, 'input.json'), JSON.stringify({ topic: 'GPT-5' }));

    const result = await runAgentWithTimeout(agent, ctx, 50 /* ms */);
    expect(result.success).toBe(false);
    expect(result.error?.message).toMatch(/timeout/i);

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });

  // Acceptance: "Error classification works for transient/recoverable/fatal"
  it('should classify a network error as transient in the result', async () => {
    const processFn = vi.fn(async (): Promise<Output> => {
      const err = new Error('ECONNRESET') as any;
      err.code = 'ECONNRESET';
      throw err;
    });
    const agent = new MockAgent(processFn);
    const ctx = makeCtx();

    const fs = await import('node:fs');
    const path = await import('node:path');
    fs.mkdirSync(ctx.runDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.runDir, 'input.json'), JSON.stringify({ topic: 'GPT-5' }));

    const result = await runAgentWithTimeout(agent, ctx, 5000);
    expect(result.success).toBe(false);
    expect(result.error?.errorType).toBe('transient');

    fs.rmSync(ctx.runDir, { recursive: true, force: true });
  });
});
