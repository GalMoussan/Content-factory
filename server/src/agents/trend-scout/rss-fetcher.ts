import { XMLParser } from 'fast-xml-parser';
import { RSS_FEEDS } from './config.js';

export interface RssItem {
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string;
  readonly summary: string;
}

/**
 * Parse an RSS XML string into a list of RssItem objects.
 * Uses fast-xml-parser for XML parsing.
 */
export function parseRssFeed(xml: string): readonly RssItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'item',
  });

  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;

  if (!channel?.item) {
    return [];
  }

  const items: RssItem[] = channel.item.map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ''),
    url: String(item.link ?? ''),
    publishedAt: item.pubDate
      ? new Date(String(item.pubDate)).toISOString()
      : new Date().toISOString(),
    summary: String(item.description ?? ''),
  }));

  return items;
}

/**
 * Fetch and parse a single RSS feed URL.
 * Returns an empty array on failure (graceful degradation).
 */
async function fetchSingleFeed(feedUrl: string): Promise<readonly RssItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'ContentFactory/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return parseRssFeed(xml);
  } catch {
    return [];
  }
}

/**
 * Fetch all configured RSS feeds in parallel.
 * Gracefully degrades: failed feeds are silently skipped.
 */
export async function fetchRssFeeds(): Promise<readonly RssItem[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((url) => fetchSingleFeed(url)),
  );

  const items: RssItem[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    }
  }

  return items;
}
