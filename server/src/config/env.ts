/**
 * Environment variable validation — validates at import time,
 * exits with code 1 if required vars are missing.
 */

const REQUIRED_KEYS = [
  'ANTHROPIC_API_KEY',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN',
  'AZURE_TTS_KEY',
  'AZURE_TTS_REGION',
] as const;

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `Missing required environment variables: ${missing.join(', ')}`,
  );
  process.exit(1);
}

export interface AppConfig {
  readonly anthropicApiKey: string;
  readonly youtubeClientId: string;
  readonly youtubeClientSecret: string;
  readonly youtubeRefreshToken: string;
  readonly azureTtsKey: string;
  readonly azureTtsRegion: string;
  readonly port: number;
  readonly cronSchedule: string;
  readonly logLevel: string;
}

export const config: AppConfig = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID!,
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
  youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN!,
  azureTtsKey: process.env.AZURE_TTS_KEY!,
  azureTtsRegion: process.env.AZURE_TTS_REGION!,
  port: (() => {
    const raw = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
    return Number.isInteger(raw) && raw > 0 ? raw : 3001;
  })(),
  cronSchedule: process.env.CRON_SCHEDULE ?? '0 6 * * *',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
