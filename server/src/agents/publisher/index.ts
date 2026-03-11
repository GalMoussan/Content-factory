/**
 * Publisher Agent (T011)
 *
 * Reads QA result and content bundle, uploads approved videos to YouTube,
 * and writes a publish record to both the filesystem queue and SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ZodType } from 'zod';
import { BaseAgent } from '../base-agent.js';
import { QAResultSchema, ContentBundleSchema, PublishRecordSchema } from '@shared/schemas';
import type { QAResult, ContentBundle, PublishRecord } from '@shared/schemas';
import type { AgentContext } from '@shared/types/agent';
import { getValidAccessToken } from './youtube-auth.js';
import { uploadVideo } from './uploader.js';
import { calculatePublishTime } from './scheduler.js';
import { optimizeMetadata } from './metadata-optimizer.js';

export class PublisherAgent extends BaseAgent<QAResult, PublishRecord> {
  public readonly inputSchema: ZodType<QAResult> = QAResultSchema as ZodType<QAResult>;
  public readonly outputSchema: ZodType<PublishRecord> = PublishRecordSchema as ZodType<PublishRecord>;

  constructor() {
    super({
      name: 'publisher',
      inputFile: 'qa-result.json',
      outputFile: 'publish-log.json',
    });
  }

  protected async process(qaResult: QAResult, ctx: AgentContext): Promise<PublishRecord> {
    // Read the content bundle (additional input beyond the base class's single inputFile)
    const contentPath = path.join(ctx.runDir, 'content.json');
    const contentRaw = fs.readFileSync(contentPath, 'utf8');
    const contentBundle: ContentBundle = ContentBundleSchema.parse(JSON.parse(contentRaw));

    // Skip upload if QA verdict is not 'approved'
    if (qaResult.verdict !== 'approved') {
      ctx.logger.info({ verdict: qaResult.verdict }, 'QA verdict not approved — skipping upload.');

      const skippedRecord: PublishRecord = {
        topicId: qaResult.topicId,
        runId: ctx.runId,
        status: 'skipped',
        skipReason: qaResult.verdictReason,
        title: contentBundle.title,
        publishedAt: new Date().toISOString(),
      };

      this.writePublishLog(ctx, skippedRecord);
      return skippedRecord;
    }

    // Optimize metadata for YouTube limits
    const optimized = optimizeMetadata({
      title: contentBundle.title,
      description: contentBundle.description,
      tags: contentBundle.tags,
    });

    // Refresh OAuth2 token
    const accessToken = await getValidAccessToken({
      clientId: process.env.YOUTUBE_CLIENT_ID ?? '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? '',
      refreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? '',
    });

    // Calculate optional scheduled publish time
    const scheduledAt = calculatePublishTime();

    // Upload the video (with path traversal check)
    const videoPath = path.resolve(path.join(ctx.runDir, contentBundle.videoPath));
    if (!videoPath.startsWith(path.resolve(ctx.runDir) + path.sep)) {
      throw new Error(`Path traversal detected in videoPath: ${contentBundle.videoPath}`);
    }
    const { videoId, videoUrl } = await uploadVideo(
      {
        videoPath,
        title: optimized.title,
        description: optimized.description,
        tags: optimized.tags,
        privacyStatus: scheduledAt ? 'private' : 'public',
      },
      accessToken,
    );

    const publishRecord: PublishRecord = {
      topicId: qaResult.topicId,
      runId: ctx.runId,
      status: scheduledAt ? 'scheduled' : 'published',
      youtubeVideoId: videoId,
      youtubeUrl: videoUrl,
      title: optimized.title,
      publishedAt: new Date().toISOString(),
    };

    this.writePublishLog(ctx, publishRecord);
    return publishRecord;
  }

  /**
   * Persist the publish record to the SQLite publish_log table.
   */
  private writePublishLog(ctx: AgentContext, record: PublishRecord): void {
    try {
      ctx.db
        .prepare(
          `INSERT INTO publish_log (run_id, topic_id, youtube_video_id, youtube_url, title, status, scheduled_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ctx.runId,
          record.topicId,
          record.youtubeVideoId ?? null,
          record.youtubeUrl ?? null,
          record.title,
          record.status,
          null,
          record.publishedAt,
        );
    } catch {
      ctx.logger.error({ err: 'Failed to write publish_log row' });
    }
  }
}
