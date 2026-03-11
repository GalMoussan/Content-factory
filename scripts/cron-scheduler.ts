/**
 * Start the cron scheduler for daily pipeline runs.
 * Usage: npx tsx scripts/cron-scheduler.ts
 */
import path from 'node:path';
import { initDatabase } from '../server/src/db/connection.js';
import { startScheduler } from '../server/src/cron/scheduler.js';
import { executePipeline } from '../server/src/pipeline/orchestrator.js';
import { PipelineEventEmitter } from '../server/src/services/event-emitter.js';
import { canStartPipeline } from '../server/src/core/pipeline-guard.js';
import { logger } from '../server/src/logging/logger.js';

const DB_PATH = process.env['DB_PATH'] ?? path.join(process.cwd(), 'data', 'content-factory.db');

async function main(): Promise<void> {
  const db = await initDatabase(DB_PATH);
  const emitter = new PipelineEventEmitter();

  // Stub agents — replace with real implementations when ready
  const agents: Record<string, (ctx: { runDir: string }) => Promise<void>> = {
    TrendScout: async () => { logger.info('TrendScout: stub'); },
    ResearchCrawler: async () => { logger.info('ResearchCrawler: stub'); },
    ContentProducer: async () => { logger.info('ContentProducer: stub'); },
    QualityController: async () => { logger.info('QualityController: stub'); },
    Publisher: async () => { logger.info('Publisher: stub'); },
  };

  const schedule = process.env['CRON_SCHEDULE'] ?? '0 6 * * *';
  logger.info({ schedule }, 'Starting cron scheduler');

  startScheduler({
    db,
    executePipeline: (runId) => executePipeline(runId, { db, emitter, agents }),
    canStartPipeline,
    logger,
  });

  // Keep the process alive
  process.on('SIGINT', () => {
    logger.info('Shutting down scheduler');
    process.exit(0);
  });
}

main();
