import type { ScoredTopic, ResearchSource, CompetitorVideo, ResearchDossier } from '@shared/schemas';

interface DossierInput {
  readonly topic: ScoredTopic;
  readonly scrapedSources: readonly ResearchSource[];
  readonly competitors: readonly CompetitorVideo[];
}

/**
 * Build a ResearchDossier from a topic, scraped sources, and competitor analysis.
 */
export function buildDossier(input: DossierInput): ResearchDossier {
  const { topic, scrapedSources, competitors } = input;

  const keyPoints = extractKeyPoints(scrapedSources);
  const suggestedAngle = generateAngle(topic, competitors);
  const estimatedScriptMinutes = estimateMinutes(scrapedSources);

  return {
    topicId: topic.id,
    topicTitle: topic.title,
    keyPoints,
    sources: [...scrapedSources],
    competitors: [...competitors],
    suggestedAngle,
    estimatedScriptMinutes,
    researchedAt: new Date().toISOString(),
  };
}

function extractKeyPoints(sources: readonly ResearchSource[]): string[] {
  const points: string[] = [];

  for (const source of sources) {
    if (source.excerpt) {
      // Split excerpt into sentences and take key ones
      const sentences = source.excerpt
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      points.push(...sentences.slice(0, 3));
    }
  }

  // Ensure at least one key point
  if (points.length === 0) {
    points.push('Topic requires further research');
  }

  return points;
}

function generateAngle(topic: ScoredTopic, competitors: readonly CompetitorVideo[]): string {
  const allGaps = competitors.flatMap((c) => c.gaps);
  if (allGaps.length > 0) {
    return `Focus on: ${allGaps[0]}. Cover what competitors missed for "${topic.title}".`;
  }
  return `Deep dive into ${topic.title} with unique insights and analysis.`;
}

function estimateMinutes(sources: readonly ResearchSource[]): number {
  // Base: 8 minutes. Add 1 minute per source, capped between 5 and 20.
  const estimate = 8 + sources.length;
  return Math.max(5, Math.min(20, estimate));
}
