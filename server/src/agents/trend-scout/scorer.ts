import { randomUUID } from 'node:crypto';
import type { ScoredTopic } from '@shared/schemas';
import { SCORING_WEIGHTS, DEFAULT_TOP_N } from './config.js';

export interface RawTopic {
  readonly title: string;
  readonly slug: string;
  readonly sources: readonly string[];
  readonly recencyScore: number;
  readonly engagementScore: number;
  readonly sourceCount: number;
}

interface ScorerOptions {
  readonly topN?: number;
}

/**
 * Score raw topics using weighted multi-factor scoring,
 * deduplicate by slug (keeping the highest-scoring entry),
 * and return the top N results sorted by descending score.
 */
export function scoreAndDeduplicateTopics(
  rawTopics: readonly RawTopic[],
  options: ScorerOptions = {},
): readonly ScoredTopic[] {
  const topN = options.topN ?? DEFAULT_TOP_N;

  // Score each topic
  const scored = rawTopics.map((topic) => {
    const rawScore =
      topic.recencyScore * SCORING_WEIGHTS.recency +
      topic.engagementScore * SCORING_WEIGHTS.engagement +
      topic.sourceCount * SCORING_WEIGHTS.sourceCount * 10;

    // Clamp score to [0, 100]
    const score = Math.min(100, Math.max(0, Math.round(rawScore * 100) / 100));

    return {
      id: randomUUID(),
      title: topic.title,
      slug: topic.slug,
      score,
      sources: [...topic.sources],
      fetchedAt: new Date().toISOString(),
    };
  });

  // Deduplicate by slug — keep the entry with the highest score
  const slugMap = new Map<string, ScoredTopic>();
  for (const topic of scored) {
    const existing = slugMap.get(topic.slug);
    if (!existing || topic.score > existing.score) {
      slugMap.set(topic.slug, topic);
    }
  }

  // Sort by descending score and take top N
  const deduped = Array.from(slugMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return deduped;
}
