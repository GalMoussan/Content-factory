import fs from 'node:fs';
import path from 'node:path';
import { writeQueueFileAtomic } from './atomic-write.js';

/**
 * Create a run directory with an assets subdirectory.
 */
export function createRunDir(runDir: string): void {
  fs.mkdirSync(path.join(runDir, 'assets'), { recursive: true });
}

/**
 * Write _meta.json into a run directory.
 */
export function writeRunMeta(runDir: string, meta: Record<string, unknown>): void {
  writeQueueFileAtomic(runDir, '_meta.json', meta);
}

/**
 * Move a run directory to the dead-letter directory and add _error.json.
 */
export function moveToDeadLetter(
  runDir: string,
  runId: string,
  errorMessage: string,
  deadLetterDir: string,
): void {
  const destDir = path.join(deadLetterDir, runId);
  fs.mkdirSync(deadLetterDir, { recursive: true });
  fs.renameSync(runDir, destDir);
  writeQueueFileAtomic(destDir, '_error.json', {
    message: errorMessage,
    movedAt: new Date().toISOString(),
  });
}

/**
 * List all run directories in a data directory.
 */
export function listRuns(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) return [];
  return fs.readdirSync(dataDir).filter((entry) => {
    const fullPath = path.join(dataDir, entry);
    return fs.statSync(fullPath).isDirectory() && entry.startsWith('run-');
  });
}

/**
 * Delete run directories older than maxAgeDays.
 */
export function cleanupOldRuns(dataDir: string, maxAgeDays: number): void {
  if (!fs.existsSync(dataDir)) return;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(dataDir)) {
    const fullPath = path.join(dataDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && entry.startsWith('run-') && stat.mtimeMs < cutoff) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
}
