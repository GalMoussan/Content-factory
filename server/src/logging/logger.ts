import pino from 'pino';
import type { Logger } from 'pino';

/**
 * Creates a root pino logger instance.
 * - Log level from `process.env.LOG_LEVEL` or default 'info'
 * - Uses pino-pretty transport when `NODE_ENV !== 'production'`
 */
const VALID_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

export const createRootLogger = (): Logger => {
  const envLevel = process.env['LOG_LEVEL'];
  const level = envLevel && VALID_LEVELS.has(envLevel) ? envLevel : 'info';
  const isProduction = process.env['NODE_ENV'] === 'production';

  const transport = isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      };

  return pino({
    level,
    ...(transport ? { transport } : {}),
  });
};

/** Singleton root logger for general use. */
export const logger: Logger = createRootLogger();

/**
 * Creates a child logger with `{ runId }` bindings.
 * Every log entry from this logger will include the runId field.
 */
export const createRunLogger = (runId: string): Logger =>
  logger.child({ runId });

/**
 * Creates a child logger with `{ runId, agentName }` bindings.
 * Every log entry from this logger will include both fields.
 */
export const createAgentLogger = (runId: string, agentName: string): Logger =>
  logger.child({ runId, agentName });
