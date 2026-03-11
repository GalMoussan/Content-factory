import type Database from 'better-sqlite3';
import type { Logger } from 'pino';

export interface EventEmitter {
  broadcast(event: Record<string, unknown>): void;
}

export interface AgentContext {
  readonly runId: string;
  readonly runDir: string;
  readonly db: Database.Database;
  readonly emitter: EventEmitter;
  readonly logger: Logger;
}

export interface AgentError {
  readonly errorType: 'transient' | 'recoverable' | 'fatal';
  readonly message: string;
  readonly code?: string;
}

export interface AgentResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: AgentError;
  readonly durationMs?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Agent<I = unknown, O = unknown> {
  readonly name: string;
  execute(ctx: AgentContext): Promise<AgentResult<O>>;
}
