import path from 'node:path';
import type { ZodType } from 'zod';
import { ResearchDossierSchema, ContentBundleSchema } from '@shared/schemas';
import type { ResearchDossier, ContentBundle } from '@shared/schemas';
import type { AgentContext } from '@shared/types/agent';
import { BaseAgent } from '../base-agent.js';
import { generateScript } from './script-writer.js';
import { generateNarration } from './tts-narrator.js';
import { assembleVideo } from './video-assembler.js';

/**
 * ContentProducerAgent — T009
 *
 * Reads a ResearchDossier (research.json) and produces a ContentBundle (content.json).
 * Pipeline: script generation (Claude) -> TTS narration (Azure) -> video assembly (Remotion).
 */
export class ContentProducerAgent extends BaseAgent<ResearchDossier, ContentBundle> {
  public readonly inputSchema: ZodType<ResearchDossier> = ResearchDossierSchema as unknown as ZodType<ResearchDossier>;
  public readonly outputSchema: ZodType<ContentBundle> = ContentBundleSchema as unknown as ZodType<ContentBundle>;

  constructor() {
    super({
      name: 'content-producer',
      inputFile: 'research.json',
      outputFile: 'content.json',
    });
  }

  protected async process(input: ResearchDossier, ctx: AgentContext): Promise<ContentBundle> {
    const claudeApiKey = process.env.ANTHROPIC_API_KEY ?? '';
    const azureSubscriptionKey = process.env.AZURE_TTS_KEY ?? '';
    const azureRegion = process.env.AZURE_TTS_REGION ?? 'eastus';
    const azureVoice = process.env.AZURE_TTS_VOICE ?? 'en-US-JennyNeural';

    ctx.logger.info({ topicId: input.topicId }, 'Starting content production');

    // Step 1: Generate script via Claude API
    const script = await generateScript(input, claudeApiKey);
    ctx.logger.info({ title: script.title, sectionCount: script.sections.length }, 'Script generated');

    // Step 2: Generate TTS narration via Azure
    const narration = await generateNarration(
      script.sections,
      ctx.runDir,
      { subscriptionKey: azureSubscriptionKey, region: azureRegion, voice: azureVoice },
    );
    ctx.logger.info({ durationSeconds: narration.durationSeconds }, 'Narration generated');

    // Step 3: Assemble video via Remotion
    const video = await assembleVideo(
      { sections: script.sections, narrationPath: narration.narrationPath },
      ctx.runDir,
    );
    ctx.logger.info('Video assembled');

    // Normalize paths to be relative to runDir
    const relativeNarrationPath = toRelativePath(narration.narrationPath, ctx.runDir);
    const relativeVideoPath = toRelativePath(video.videoPath, ctx.runDir);

    return {
      topicId: input.topicId,
      title: script.title,
      description: script.description,
      tags: [...script.tags],
      sections: [...script.sections],
      narrationPath: relativeNarrationPath,
      videoPath: relativeVideoPath,
      totalDurationSeconds: narration.durationSeconds,
      claudeTokensUsed: script.claudeTokensUsed,
      producedAt: new Date().toISOString(),
    };
  }
}

/**
 * Convert an absolute path to a relative path from runDir.
 * If already relative, return as-is.
 */
function toRelativePath(filePath: string, runDir: string): string {
  if (path.isAbsolute(filePath)) {
    return path.relative(runDir, filePath);
  }
  return filePath;
}
