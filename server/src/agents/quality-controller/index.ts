import path from 'node:path';
import type { ZodType } from 'zod';
import { ContentBundleSchema, QAResultSchema } from '@shared/schemas';
import type { ContentBundle, QAResult } from '@shared/schemas';
import type { AgentContext, AgentResult } from '@shared/types/agent';
import { BaseAgent } from '../base-agent.js';
import { scoreContentBundle } from './scorer.js';
import { renderVerdict } from './verdict-engine.js';

/**
 * QualityControllerAgent — evaluates a ContentBundle and produces a QAResult.
 * Reads content.json, scores via Claude Haiku, applies verdict thresholds,
 * writes qa-result.json, and records scores in the qa_scores table.
 */
export class QualityControllerAgent extends BaseAgent<ContentBundle, QAResult> {
  public readonly inputSchema: ZodType<ContentBundle> = ContentBundleSchema as ZodType<ContentBundle>;
  public readonly outputSchema: ZodType<QAResult> = QAResultSchema as ZodType<QAResult>;

  constructor() {
    super({
      name: 'quality-controller',
      inputFile: 'content.json',
      outputFile: 'qa-result.json',
    });
  }

  async execute(ctx: AgentContext): Promise<AgentResult<QAResult> & { outputPath?: string }> {
    const result = await super.execute(ctx);
    if (result.success) {
      return { ...result, outputPath: path.join(ctx.runDir, this.outputFile) };
    }
    return result;
  }

  protected async process(input: ContentBundle, ctx: AgentContext): Promise<QAResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';

    // Score all 6 dimensions via Claude Haiku
    const dimensions = await scoreContentBundle(input, apiKey);

    // Apply verdict thresholds
    const { overallScore, verdict, verdictReason } = renderVerdict(dimensions);

    const qaResult: QAResult = {
      topicId: input.topicId,
      overallScore,
      verdict,
      dimensions,
      verdictReason,
      evaluatedAt: new Date().toISOString(),
    };

    // Record in qa_scores table
    this.recordQAScore(ctx, qaResult);

    return qaResult;
  }

  private recordQAScore(ctx: AgentContext, result: QAResult): void {
    try {
      ctx.db
        .prepare(
          `INSERT INTO qa_scores (run_id, topic_id, overall_score, verdict, dimensions_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ctx.runId,
          result.topicId,
          result.overallScore,
          result.verdict,
          JSON.stringify(result.dimensions),
          result.evaluatedAt,
        );
    } catch (err) {
      ctx.logger.error({ err }, 'Failed to record QA score');
    }
  }
}
