import type { Source } from '../schemas/source.js';

export interface PipelineConfig {
  readonly sources: readonly Source[];
  readonly maxTopics: number;
  readonly qaThreshold: number;
  readonly cronSchedule: string;
}

export interface ClaudeConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;
}

export interface StorageConfig {
  readonly dataDir: string;
  readonly dbPath: string;
}

export interface AppConfig {
  readonly pipeline: PipelineConfig;
  readonly claude: ClaudeConfig;
  readonly storage: StorageConfig;
  readonly port: number;
}
