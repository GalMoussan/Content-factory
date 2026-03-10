import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRunLogger, createAgentLogger, createRootLogger } from '../logger';
import { requestLogger } from '../request-logger';
import type { Request, Response, NextFunction } from 'express';

// T006 — Structured Logging with Pino
// Tests will fail at import until logging modules are implemented.

// ---------------------------------------------------------------------------
// Root logger
// ---------------------------------------------------------------------------
describe('T006 — createRootLogger', () => {
  // Acceptance: "Root logger outputs structured JSON"
  it('should return a pino logger instance with an info method', () => {
    const logger = createRootLogger();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  // Acceptance: "Log level configurable via LOG_LEVEL env var"
  it('should use LOG_LEVEL env var when set', () => {
    const originalLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';

    const logger = createRootLogger();
    expect(logger.level).toBe('debug');

    process.env.LOG_LEVEL = originalLevel;
  });

  it('should default to "info" log level when LOG_LEVEL is not set', () => {
    const originalLevel = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;

    const logger = createRootLogger();
    expect(logger.level).toBe('info');

    process.env.LOG_LEVEL = originalLevel;
  });
});

// ---------------------------------------------------------------------------
// createRunLogger
// ---------------------------------------------------------------------------
describe('T006 — createRunLogger', () => {
  // Acceptance: "createRunLogger includes runId in all log entries"
  it('should return a child logger that has the runId bound in context', () => {
    const runId = 'run-abc-123';
    const logger = createRunLogger(runId);

    // Pino child loggers expose their bindings via logger.bindings()
    const bindings = logger.bindings();
    expect(bindings.runId).toBe(runId);
  });

  it('should produce a logger that can call info without throwing', () => {
    const logger = createRunLogger('run-001');
    expect(() => logger.info('test message')).not.toThrow();
  });

  it('should support structured metadata in log calls', () => {
    const logger = createRunLogger('run-001');
    expect(() => logger.info({ agent: 'TrendScout', topicsFound: 5 }, 'agent completed')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createAgentLogger
// ---------------------------------------------------------------------------
describe('T006 — createAgentLogger', () => {
  // Acceptance: "createAgentLogger includes runId and agentName"
  it('should bind both runId and agentName to the child logger', () => {
    const runId = 'run-abc-123';
    const agentName = 'TrendScout';
    const logger = createAgentLogger(runId, agentName);

    const bindings = logger.bindings();
    expect(bindings.runId).toBe(runId);
    expect(bindings.agentName).toBe(agentName);
  });

  it('should create independent loggers for different agents in the same run', () => {
    const loggerA = createAgentLogger('run-001', 'TrendScout');
    const loggerB = createAgentLogger('run-001', 'ResearchCrawler');

    expect(loggerA.bindings().agentName).toBe('TrendScout');
    expect(loggerB.bindings().agentName).toBe('ResearchCrawler');
  });

  it('should not throw when logging errors with stack traces', () => {
    const logger = createAgentLogger('run-001', 'ContentProducer');
    const err = new Error('Azure TTS failed');
    expect(() => logger.error({ err }, 'TTS narration failed')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// requestLogger middleware
// ---------------------------------------------------------------------------
describe('T006 — requestLogger middleware', () => {
  // Acceptance: "Request logger middleware logs method, path, status, duration"
  it('should call next() to continue the middleware chain', () => {
    const req = { method: 'GET', url: '/api/runs', path: '/api/runs' } as Request;
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') cb();
      }),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    expect(() => requestLogger(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
  });

  it('should be a function with arity 3 (req, res, next)', () => {
    expect(typeof requestLogger).toBe('function');
    expect(requestLogger.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Pretty print in development
// ---------------------------------------------------------------------------
describe('T006 — Environment-aware transport', () => {
  // Acceptance: "Pretty print active when NODE_ENV !== 'production'"
  it('should not throw when creating a logger in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    expect(() => createRootLogger()).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  it('should not throw when creating a logger in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    expect(() => createRootLogger()).not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });
});
