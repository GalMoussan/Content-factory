export enum ErrorCode {
  EXTERNAL_API_FAILURE = 'EXTERNAL_API_FAILURE',
  RATE_LIMITED = 'RATE_LIMITED',
  BROWSER_CRASH = 'BROWSER_CRASH',
  TIMEOUT = 'TIMEOUT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  FATAL = 'FATAL',
}

export interface ErrorClassification {
  readonly retryable: boolean;
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly multiplier: number;
  readonly maxDelay: number;
}

const CLASSIFICATION_MAP: Record<ErrorCode, ErrorClassification> = {
  [ErrorCode.EXTERNAL_API_FAILURE]: {
    retryable: true,
    maxAttempts: 3,
    baseDelay: 1_000,
    multiplier: 2,
    maxDelay: 30_000,
  },
  [ErrorCode.RATE_LIMITED]: {
    retryable: true,
    maxAttempts: 3,
    baseDelay: 5_000,
    multiplier: 2,
    maxDelay: 60_000,
  },
  [ErrorCode.BROWSER_CRASH]: {
    retryable: true,
    maxAttempts: 1,
    baseDelay: 2_000,
    multiplier: 1,
    maxDelay: 2_000,
  },
  [ErrorCode.TIMEOUT]: {
    retryable: true,
    maxAttempts: 2,
    baseDelay: 5_000,
    multiplier: 2,
    maxDelay: 15_000,
  },
  [ErrorCode.AUTH_FAILURE]: {
    retryable: false,
    maxAttempts: 1,
    baseDelay: 0,
    multiplier: 1,
    maxDelay: 0,
  },
  [ErrorCode.FATAL]: {
    retryable: false,
    maxAttempts: 1,
    baseDelay: 0,
    multiplier: 1,
    maxDelay: 0,
  },
};

/**
 * Classify an error code into retry configuration.
 */
export function classifyError(code: ErrorCode): ErrorClassification {
  return CLASSIFICATION_MAP[code];
}
