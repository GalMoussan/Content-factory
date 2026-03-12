import type { Logger } from 'pino';
import type { ResearchSource } from '@shared/schemas';

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export interface ScrapedPage {
  readonly url: string;
  readonly title: string;
  readonly paragraphs: string[];
}

/**
 * Extract text content from raw HTML by stripping tags.
 * Extracts title, and paragraph text.
 */
function extractFromHtml(html: string): { title: string; paragraphs: string[] } {
  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  // Extract <p> tag contents
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, '') // strip nested tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 20) {
      paragraphs.push(text);
    }
  }

  return { title, paragraphs };
}

/**
 * Scrape a single web page using fetch (no browser required).
 * Returns null if the request fails.
 */
export async function scrapeWebPage(
  url: string,
  browser?: { newPage: () => Promise<any> },
  logger?: Logger,
): Promise<ScrapedPage | null> {
  // If a Playwright browser is provided, use it
  if (browser) {
    let page: any = null;
    try {
      page = await browser.newPage();
      await page.goto(url);
      const title: string = await page.title();
      const { paragraphs } = await page.evaluate(() => ({
        paragraphs: Array.from(document.querySelectorAll('p')).map((p: any) => p.textContent ?? ''),
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).map((h: any) => h.textContent ?? ''),
      }));
      return { url, title, paragraphs };
    } catch (err) {
      logger?.warn({ url, err }, 'Playwright scrape failed');
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  // Fallback: fetch-based scraping (no browser needed)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ContentFactory/1.0 (ResearchCrawler)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });

    if (!response.ok) {
      logger?.warn({ url, status: response.status }, 'Web scrape returned non-OK status');
      return null;
    }

    const html = await response.text();
    const { title, paragraphs } = extractFromHtml(html);

    return { url, title, paragraphs };
  } catch (err) {
    logger?.warn({ url, err }, 'Web scrape fetch failed');
    return null;
  }
}

/**
 * Scrape multiple URLs and return an array of ResearchSource objects.
 * Uses fetch-based scraping by default; uses Playwright browser if provided.
 */
export async function scrapeUrls(
  urls: readonly string[],
  browser?: { newPage: () => Promise<any>; close: () => Promise<void> },
  logger?: Logger,
): Promise<(ResearchSource | null)[]> {
  const results: (ResearchSource | null)[] = [];

  for (const url of urls) {
    if (!isSafeUrl(url)) {
      results.push(null);
      continue;
    }

    const page = await scrapeWebPage(url, browser ?? undefined, logger);
    if (page) {
      results.push({
        url: page.url,
        title: page.title,
        excerpt: page.paragraphs.slice(0, 3).join(' ').slice(0, 500),
        scrapedAt: new Date().toISOString(),
      });
    } else {
      results.push(null);
    }
  }

  return results;
}
