import path from 'node:path';

export const QUEUE_DATA_DIR = path.join('queue', 'data');
export const QUEUE_DEAD_LETTER_DIR = path.join('queue', 'dead-letter');

export function getRunDir(runId: string): string {
  return path.join(QUEUE_DATA_DIR, `run-${runId}`);
}

export function getAssetsDir(runId: string): string {
  return path.join(getRunDir(runId), 'assets');
}
