import { YOUTUBE_QUERIES } from './config.js';

export interface YouTubeVideo {
  readonly title: string;
  readonly channelName: string;
  readonly viewCount: number;
  readonly videoId: string;
  readonly publishedAt: string;
}

/**
 * Fetch trending YouTube videos for a search query using the YouTube Data API v3.
 * Returns an empty array if the API key is missing or on failure (graceful degradation).
 */
export async function fetchYouTubeTrends(
  query: string,
  apiKey: string,
): Promise<readonly YouTubeVideo[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      q: query,
      type: 'video',
      order: 'viewCount',
      maxResults: '10',
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!response.ok) {
      return [];
    }

    const json = await response.json() as {
      items: Array<{
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          publishedAt: string;
          description: string;
        };
        statistics?: { viewCount?: string; likeCount?: string };
      }>;
    };

    const videos: YouTubeVideo[] = (json.items ?? []).map((item) => ({
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      viewCount: Number(item.statistics?.viewCount ?? 0),
      videoId: item.id.videoId,
      publishedAt: item.snippet.publishedAt,
    }));

    return videos;
  } catch {
    return [];
  }
}

/**
 * Fetch YouTube trends for all configured queries in parallel.
 * Gracefully degrades: failed queries are silently skipped.
 */
export async function fetchAllYouTubeTrends(): Promise<readonly YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY ?? '';

  if (!apiKey) {
    return [];
  }

  const results = await Promise.allSettled(
    YOUTUBE_QUERIES.map((q) => fetchYouTubeTrends(q, apiKey)),
  );

  const videos: YouTubeVideo[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      videos.push(...result.value);
    }
  }

  return videos;
}
