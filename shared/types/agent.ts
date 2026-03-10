import type { AgentError } from '../schemas/agent-error.js';

export interface AgentContext {
  readonly runId: string;
  readonly dataDir: string;
  readonly startedAt: string;
}

export interface AgentResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AgentError;
  readonly durationMs: number;
}

export interface Agent {
  readonly name: string;
  run(context: AgentContext): Promise<AgentResult>;
}
