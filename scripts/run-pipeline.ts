/**
 * Run the content pipeline once (manual trigger).
 * Usage: npx tsx scripts/run-pipeline.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase } from '../server/src/db/connection.js';
import { executePipeline } from '../server/src/pipeline/orchestrator.js';
import { PipelineEventEmitter } from '../server/src/services/event-emitter.js';
import { logger } from '../server/src/logging/logger.js';

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

// -- Import real agent classes --
import { TrendScoutAgent } from '../server/src/agents/trend-scout/index.js';
import { ResearchCrawlerAgent } from '../server/src/agents/research-crawler/index.js';
import { ContentProducerAgent } from '../server/src/agents/content-producer/index.js';
import { QualityControllerAgent } from '../server/src/agents/quality-controller/index.js';
import { PublisherAgent } from '../server/src/agents/publisher/index.js';

const DB_PATH = process.env['DB_PATH'] ?? path.join(process.cwd(), 'data', 'content-factory.db');

async function main(): Promise<void> {
  // Ensure data directory exists
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = await initDatabase(DB_PATH);
  const emitter = new PipelineEventEmitter();
  const runId = `run-${uuidv4()}`;

  logger.info({ runId }, 'Starting manual pipeline run');

  // Instantiate real agents
  const trendScout = new TrendScoutAgent();
  const researchCrawler = new ResearchCrawlerAgent();
  const contentProducer = new ContentProducerAgent();
  const qualityController = new QualityControllerAgent();
  const publisher = new PublisherAgent();

  // Adapter: the orchestrator expects (ctx: { runDir }) => Promise<void>,
  // but BaseAgent.execute() needs a full AgentContext and returns AgentResult.
  // We bridge by creating AgentContext from the orchestrator's runDir + shared deps,
  // then throwing if the agent fails so the orchestrator catches it.
  function wrapAgent(agent: InstanceType<typeof TrendScoutAgent | typeof ResearchCrawlerAgent | typeof ContentProducerAgent | typeof QualityControllerAgent | typeof PublisherAgent>) {
    return async (ctx: { runDir: string }) => {
      const agentCtx = {
        runId,
        runDir: ctx.runDir,
        db,
        emitter: {
          broadcast(event: Record<string, unknown>) {
            // Adapt flat agent events to SSEEvent shape for PipelineEventEmitter
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

  const agents: Record<string, (ctx: { runDir: string }) => Promise<void>> = {
    TrendScout: wrapAgent(trendScout),
    ResearchCrawler: wrapAgent(researchCrawler),
    ContentProducer: wrapAgent(contentProducer),
    QualityController: wrapAgent(qualityController),
    Publisher: wrapAgent(publisher),
  };

  try {
    await executePipeline(runId, { db, emitter, agents });
    logger.info({ runId }, 'Pipeline completed successfully');
  } catch (err) {
    logger.error({ err, runId }, 'Pipeline failed');
    process.exit(1);
  }
}

main();
