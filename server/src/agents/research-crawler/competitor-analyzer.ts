import type { Logger } from 'pino';
import type { CompetitorVideo } from '@shared/schemas';

/**
 * Search YouTube for competitor videos on a topic and identify content gaps.
 * Returns an empty array if the API call fails.
 */
export async function analyzeCompetitors(
  query: string,
  apiKey: string,
  logger?: Logger,
): Promise<CompetitorVideo[]> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: '10',
      key: apiKey,
    });
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!response.ok) {
      logger?.warn({ query, status: response.status }, 'YouTube competitor API returned non-OK status');
      return [];
    }

    const data = await response.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          publishedAt: string;
          description: string;
        };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
        };
      }>;
    };

    return data.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      viewCount: Number(item.statistics?.viewCount ?? 0),
      publishedAt: item.snippet.publishedAt,
      gaps: identifyGaps(item.snippet.description),
    }));
  } catch (err) {
    logger?.warn({ query, err }, 'Competitor analysis failed');
    return [];
  }
}

/**
 * Simple gap identification based on missing keywords in the description.
 */
function identifyGaps(description: string): string[] {
  const gaps: string[] = [];
  const keywords = ['pricing', 'migration', 'benchmark', 'comparison', 'tutorial', 'API'];

  for (const keyword of keywords) {
    if (!description.toLowerCase().includes(keyword.toLowerCase())) {
      gaps.push(`Missing ${keyword} coverage`);
    }
  }

  return gaps;
}
