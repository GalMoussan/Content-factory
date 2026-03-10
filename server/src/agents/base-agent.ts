import fs from 'node:fs';
import path from 'node:path';
import type { ZodType } from 'zod';
import type { AgentContext, AgentResult } from '@shared/types/agent';
import { writeQueueFileAtomic } from '../queue/atomic-write.js';

interface BaseAgentOptions {
  readonly name: string;
  readonly inputFile: string | null;
  readonly outputFile: string;
}

/**
 * Abstract base class for all pipeline agents.
 * Implements the template method pattern:
 *   read input → validate → process → validate output → write → record → emit
 */
export abstract class BaseAgent<I, O> {
  public readonly name: string;
  protected readonly inputFile: string | null;
  protected readonly outputFile: string;

  public abstract readonly inputSchema: ZodType<I>;
  public abstract readonly outputSchema: ZodType<O>;

  constructor(options: BaseAgentOptions) {
    this.name = options.name;
    this.inputFile = options.inputFile;
    this.outputFile = options.outputFile;
  }

  /**
   * Template method — the full agent lifecycle.
   */
  async execute(ctx: AgentContext): Promise<AgentResult<O>> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    // Emit agent:started
    ctx.emitter.broadcast({
      type: 'agent:started',
      runId: ctx.runId,
      agentName: this.name,
      timestamp: startedAt,
    });

    try {
      // Step 1: Read and validate input (skip if inputFile is null)
      let input: I;
      if (this.inputFile !== null) {
        const inputPath = path.join(ctx.runDir, this.inputFile);
        const raw = fs.readFileSync(inputPath, 'utf8');
        const parsed = JSON.parse(raw);
        input = this.inputSchema.parse(parsed);
      } else {
        input = null as I;
      }

      // Step 2: Call the concrete agent's process method
      const output = await this.process(input, ctx);

      // Step 3: Validate output
      const validatedOutput = this.outputSchema.parse(output);

      // Step 4: Write output atomically
      writeQueueFileAtomic(ctx.runDir, this.outputFile, validatedOutput);

      // Step 5: Record in SQLite
      const durationMs = Date.now() - startMs;
      this.recordExecution(ctx, {
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        outputFile: this.outputFile,
      });

      // Step 6: Emit agent:completed
      ctx.emitter.broadcast({
        type: 'agent:completed',
        runId: ctx.runId,
        agentName: this.name,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      return { success: true, data: validatedOutput, durationMs };
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const error = err instanceof Error ? err : new Error(String(err));

      // Record failure
      this.recordExecution(ctx, {
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs,
        error: error.message,
      });

      // Emit agent:failed
      ctx.emitter.broadcast({
        type: 'agent:failed',
        runId: ctx.runId,
        agentName: this.name,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: {
          errorType: classifyError(error),
          message: error.message,
        },
        durationMs,
      };
    }
  }

  /**
   * Concrete agents implement this to do their domain-specific work.
   */
  protected abstract process(input: I, ctx: AgentContext): Promise<O>;

  private recordExecution(
    ctx: AgentContext,
    data: {
      status: string;
      startedAt: string;
      completedAt: string;
      durationMs: number;
      outputFile?: string;
      error?: string;
    },
  ): void {
    try {
      ctx.db
        .prepare(
          `INSERT INTO agent_executions (run_id, agent_name, status, started_at, completed_at, duration_ms, output_file, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ctx.runId,
          this.name,
          data.status,
          data.startedAt,
          data.completedAt,
          data.durationMs,
          data.outputFile ?? null,
          data.error ?? null,
        );
    } catch {
      // Don't let DB recording failure break the agent
      ctx.logger.error({ err: 'Failed to record agent execution' });
    }
  }
}

/**
 * Classify errors into transient/recoverable/fatal.
 */
function classifyError(err: Error & { code?: string }): 'transient' | 'recoverable' | 'fatal' {
  const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
  const transientMessages = ['timeout', 'rate limit', '503', '429', 'ECONNRESET'];

  if (err.code && transientCodes.has(err.code)) return 'transient';
  if (transientMessages.some((m) => err.message.toLowerCase().includes(m.toLowerCase()))) return 'transient';

  // Zod validation errors are fatal (data corruption)
  if (err.name === 'ZodError') return 'fatal';

  return 'recoverable';
}
