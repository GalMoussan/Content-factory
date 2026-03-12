/**
 * Start the cron scheduler for daily pipeline runs.
 * Usage: npx tsx scripts/cron-scheduler.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase } from '../server/src/db/connection.js';
import { startScheduler } from '../server/src/cron/scheduler.js';
import { executePipeline } from '../server/src/pipeline/orchestrator.js';
import { PipelineEventEmitter } from '../server/src/services/event-emitter.js';
import { canStartPipeline } from '../server/src/core/pipeline-guard.js';
import { logger } from '../server/src/logging/logger.js';
import { TrendScoutAgent } from '../server/src/agents/trend-scout/index.js';
import { ResearchCrawlerAgent } from '../server/src/agents/research-crawler/index.js';
import { ContentProducerAgent } from '../server/src/agents/content-producer/index.js';
import { QualityControllerAgent } from '../server/src/agents/quality-controller/index.js';
import { PublisherAgent } from '../server/src/agents/publisher/index.js';

// -- Load .env manually (no dotenv dependency) --
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const DB_PATH = process.env['DB_PATH'] ?? path.join(process.cwd(), 'data', 'content-factory.db');

async function main(): Promise<void> {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = await initDatabase(DB_PATH);
  const emitter = new PipelineEventEmitter();

  // Instantiate real agents
  const trendScout = new TrendScoutAgent();
  const researchCrawler = new ResearchCrawlerAgent();
  const contentProducer = new ContentProducerAgent();
  const qualityController = new QualityControllerAgent();
  const publisher = new PublisherAgent();

  // Adapter: orchestrator expects (ctx: { runDir }) => Promise<void>,
  // BaseAgent.execute() needs AgentContext and returns AgentResult.
  function wrapAgent(agent: InstanceType<typeof TrendScoutAgent | typeof ResearchCrawlerAgent | typeof ContentProducerAgent | typeof QualityControllerAgent | typeof PublisherAgent>, runId: string) {
    return async (ctx: { runDir: string }) => {
      const agentCtx = {
        runId,
        runDir: ctx.runDir,
        db,
        emitter: {
          broadcast(event: Record<string, unknown>) {
            const { type, ...rest } = event;
            if (typeof type === 'string') {
              emitter.broadcast({ type, data: rest });
            }
          },
        },
        logger: logger.child({ agent: agent.name }),
      };

      const result = await agent.execute(agentCtx);

      if (!result.success) {
        const errMsg = result.error?.message ?? `Agent ${agent.name} failed`;
        throw new Error(errMsg);
      }

      logger.info(
        { agent: agent.name, durationMs: result.durationMs },
        `Agent ${agent.name} completed`,
      );
    };
  }

  const schedule = process.env['CRON_SCHEDULE'] ?? '0 6 * * *';
  logger.info({ schedule }, 'Starting cron scheduler');

  startScheduler({
    db,
    executePipeline: (runId) => {
      const agents: Record<string, (ctx: { runDir: string }) => Promise<void>> = {
        TrendScout: wrapAgent(trendScout, runId),
        ResearchCrawler: wrapAgent(researchCrawler, runId),
        ContentProducer: wrapAgent(contentProducer, runId),
        QualityController: wrapAgent(qualityController, runId),
        Publisher: wrapAgent(publisher, runId),
      };
      return executePipeline(runId, { db, emitter, agents });
    },
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
