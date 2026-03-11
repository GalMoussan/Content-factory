import path from 'node:path';
import type { ZodType } from 'zod';
import { ScoredTopicListSchema, ResearchDossierSchema } from '@shared/schemas';
import type { ScoredTopicList, ResearchDossier } from '@shared/schemas';
import type { AgentContext, AgentResult } from '@shared/types/agent';
import { BaseAgent } from '../base-agent.js';
import { selectTopTopic } from './topic-selector.js';
import { scrapeUrls } from './web-scraper.js';
import { analyzeCompetitors } from './competitor-analyzer.js';
import { buildDossier } from './dossier-builder.js';

/**
 * ResearchCrawlerAgent — T008
 *
 * Reads scored topics (topics.json) and produces a ResearchDossier (research.json).
 * Pipeline: topic selection -> web scraping -> competitor analysis -> dossier assembly.
 */
export class ResearchCrawlerAgent extends BaseAgent<ScoredTopicList, ResearchDossier> {
  public readonly inputSchema: ZodType<ScoredTopicList> = ScoredTopicListSchema as unknown as ZodType<ScoredTopicList>;
  public readonly outputSchema: ZodType<ResearchDossier> = ResearchDossierSchema as unknown as ZodType<ResearchDossier>;

  constructor() {
    super({
      name: 'research-crawler',
      inputFile: 'topics.json',
      outputFile: 'research.json',
    });
  }

  async execute(ctx: AgentContext): Promise<AgentResult<ResearchDossier> & { outputPath?: string }> {
    const result = await super.execute(ctx);
    if (result.success) {
      return { ...result, outputPath: path.join(ctx.runDir, this.outputFile) };
    }
    return result;
  }

  protected async process(input: ScoredTopicList, ctx: AgentContext): Promise<ResearchDossier> {
    const youtubeApiKey = process.env.YOUTUBE_API_KEY ?? '';

    // Step 1: Select the highest-scoring topic
    const topic = selectTopTopic(input);
    ctx.logger.info({ topicId: topic.id, title: topic.title }, 'Selected top topic');

    // Step 2: Scrape source URLs
    const scrapedResults = await scrapeUrls(topic.sources);
    const scrapedSources = scrapedResults.filter(
      (s): s is NonNullable<typeof s> => s !== null,
    );
    ctx.logger.info({ scraped: scrapedSources.length, total: topic.sources.length }, 'Scraping complete');

    // Step 3: Analyze competitor videos
    const competitors = await analyzeCompetitors(topic.title, youtubeApiKey);
    ctx.logger.info({ competitors: competitors.length }, 'Competitor analysis complete');

    // Step 4: Build the research dossier
    const dossier = buildDossier({ topic, scrapedSources, competitors });

    return dossier;
  }
}
