import { FatalError } from './errors.js';

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly multiplier: number;
  readonly maxDelay: number;
}

/**
 * Retry a function with exponential backoff.
 * - FatalError bypasses retry entirely.
 * - AbortSignal cancels pending retry waits.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  logger?: { warn: (...args: unknown[]) => void },
  signal?: AbortSignal,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Retry aborted');
    }

    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // FatalError — never retry
      if (err instanceof FatalError) {
        throw err;
      }

      // Last attempt — throw immediately
      if (attempt >= config.maxAttempts) {
        break;
      }

      // Calculate backoff delay
      const delay = Math.min(
        config.baseDelay * Math.pow(config.multiplier, attempt - 1),
        config.maxDelay,
      );

      logger?.warn(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`);

      // Wait with abort support
      await new Promise<void>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('Retry aborted'));
          return;
        }

        const timer = setTimeout(resolve, delay);

        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Retry aborted'));
        }, { once: true });
      });
    }
  }

  throw lastError!;
}
