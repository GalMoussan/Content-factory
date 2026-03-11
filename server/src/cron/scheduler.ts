import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

const DEFAULT_SCHEDULE = '0 6 * * *';

interface SchedulerDeps {
  readonly db: Database.Database;
  readonly executePipeline: (runId: string, deps: unknown) => Promise<void>;
  readonly canStartPipeline?: (db: Database.Database, lockFile: string) => { allowed: boolean; reason?: string };
  readonly logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

interface SchedulerHandle {
  stop: () => void;
  destroy: () => void;
}

let activeTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the cron scheduler for pipeline runs.
 */
export function startScheduler(deps: SchedulerDeps): SchedulerHandle {
  const schedule = process.env.CRON_SCHEDULE ?? DEFAULT_SCHEDULE;
  const { db, executePipeline, canStartPipeline, logger } = deps;

  const task = cron.schedule(schedule, async () => {
    // Check guard if provided
    if (canStartPipeline) {
      const guard = canStartPipeline(db, 'queue/.pipeline.lock');
      if (!guard.allowed) {
        logger?.warn(`Pipeline skipped by guard: ${guard.reason}`);
        return;
      }
    }

    const runId = `run-${uuidv4()}`;
    logger?.info(`Cron triggering pipeline run: ${runId}`);

    try {
      await executePipeline(runId, { db });
    } catch (err) {
      logger?.error(`Pipeline run ${runId} failed: ${(err as Error).message}`);
    }
  }, { scheduled: true } as Record<string, unknown>);

  activeTask = task;

  return {
    stop: () => task.stop(),
    destroy: () => task.stop(),
  };
}

/**
 * Stop the active scheduler.
 */
export function stopScheduler(): void {
  if (activeTask) {
    activeTask.stop();
    activeTask = null;
  }
}
