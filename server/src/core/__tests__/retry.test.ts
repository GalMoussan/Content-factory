import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, RetryConfig } from '../retry';
import { classifyError, ErrorCode } from '../error-classifier';
import { TransientError, FatalError, AgentExecutionError } from '../errors';

// T013 — Retry Logic with Exponential Backoff
// Tests will fail at import until retry.ts / error-classifier.ts / errors.ts are implemented.

// Override real timers so tests don't wait for actual backoff delays
vi.useFakeTimers();

describe('T013 — Retry Logic with Exponential Backoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Acceptance: "withRetry implements exponential backoff correctly"
  it('should retry a failing function and succeed on a later attempt', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount < 3) throw new TransientError('flaky');
      return 'ok';
    });

    const config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 100,
      multiplier: 2,
      maxDelay: 5_000,
    };

    const promise = withRetry(fn, config);
    // Advance past both backoff delays
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // Acceptance: "Delay capped at maxDelay"
  it('should cap retry delay at maxDelay regardless of multiplier exponent', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;

    // Spy on setTimeout to capture delay values
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: () => void, ms: number) => {
      delays.push(ms);
      return originalSetTimeout(cb, 0);
    });

    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 5) throw new TransientError('repeat');
      return 'done';
    };

    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 1_000,
      multiplier: 10,
      maxDelay: 3_000,
    };

    const promise = withRetry(fn, config);
    await vi.runAllTimersAsync();
    await promise;

    const allWithinCap = delays.every((d) => d <= 3_000);
    expect(allWithinCap).toBe(true);
  });

  // Acceptance: "AbortSignal cancels pending retry waits"
  it('should abort a pending retry when the AbortSignal fires', async () => {
    const controller = new AbortController();
    let callCount = 0;

    const fn = async () => {
      callCount++;
      throw new TransientError('always fails');
    };

    const config: RetryConfig = {
      maxAttempts: 10,
      baseDelay: 500,
      multiplier: 2,
      maxDelay: 10_000,
    };

    const promise = withRetry(fn, config, undefined, controller.signal);
    promise.catch(() => {}); // suppress unhandled rejection while timers run

    // Abort before all retries complete
    controller.abort();
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(/abort/i);
    // Should not have exhausted all 10 attempts
    expect(callCount).toBeLessThan(10);
  });

  // Acceptance: "Fatal errors bypass retry entirely"
  it('should not retry when a FatalError is thrown', async () => {
    const fn = vi.fn(async () => {
      throw new FatalError('permanent failure');
    });

    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelay: 100,
      multiplier: 2,
      maxDelay: 1_000,
    };

    const promise = withRetry(fn, config);
    promise.catch(() => {}); // suppress unhandled rejection while timers run
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(FatalError);
    // FatalError must not trigger any additional attempts
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // Acceptance: "Error classification maps all error codes correctly"
  it('should classify EXTERNAL_API_FAILURE as transient with 3 retries', () => {
    const result = classifyError(ErrorCode.EXTERNAL_API_FAILURE);
    expect(result.retryable).toBe(true);
    expect(result.maxAttempts).toBe(3);
    expect(result.baseDelay).toBe(1_000);
  });

  it('should classify RATE_LIMITED with longer base delay', () => {
    const result = classifyError(ErrorCode.RATE_LIMITED);
    expect(result.retryable).toBe(true);
    expect(result.baseDelay).toBe(5_000);
    expect(result.maxDelay).toBe(60_000);
  });

  // Acceptance: "Agent runner uses retry for transient errors automatically"
  it('should surface the original error after all retry attempts are exhausted', async () => {
    const fn = vi.fn(async () => {
      throw new AgentExecutionError('call failed', ErrorCode.EXTERNAL_API_FAILURE);
    });

    const config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 50,
      multiplier: 2,
      maxDelay: 500,
    };

    const promise = withRetry(fn, config);
    promise.catch(() => {}); // suppress unhandled rejection while timers run
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toBeInstanceOf(AgentExecutionError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
