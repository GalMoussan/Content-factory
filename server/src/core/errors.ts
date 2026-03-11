/**
 * Error hierarchy for agent execution.
 * - TransientError: temporary failures that should be retried
 * - RecoverableError: agent can be restarted
 * - FatalError: abort, no retry
 */

export class TransientError extends Error {
  readonly retryable = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

export class RecoverableError extends Error {
  readonly retryable = false as const;
  constructor(message: string) {
    super(message);
    this.name = 'RecoverableError';
  }
}

export class FatalError extends Error {
  readonly retryable = false as const;
  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

export class AgentExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AgentExecutionError';
    this.code = code;
    this.retryable = !['FATAL', 'AUTH_FAILURE'].includes(code);
  }
}
