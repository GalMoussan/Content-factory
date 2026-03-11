import fs from 'node:fs';
import path from 'node:path';

interface DeadLetterEntry {
  readonly runId: string;
  readonly errorFile: string | null;
}

interface ReplayOptions {
  readonly fromAgent: string;
  readonly dataDir: string;
  readonly deadLetterDir: string;
}

/**
 * List all runs currently in the dead-letter queue.
 */
export function listDeadLetterRuns(deadLetterDir: string): DeadLetterEntry[] {
  if (!fs.existsSync(deadLetterDir)) return [];

  return fs
    .readdirSync(deadLetterDir)
    .filter((entry) => {
      const fullPath = path.join(deadLetterDir, entry);
      return fs.statSync(fullPath).isDirectory() && entry.startsWith('run-');
    })
    .map((entry) => {
      const runId = entry.replace(/^run-/, '');
      const errorFile = path.join(deadLetterDir, entry, '_error.json');
      return {
        runId,
        errorFile: fs.existsSync(errorFile) ? errorFile : null,
      };
    });
}

/**
 * Read the error annotation for a dead-letter run.
 */
export function getDeadLetterError(runId: string, deadLetterDir: string): Record<string, unknown> | null {
  const errorFile = path.join(deadLetterDir, `run-${runId}`, '_error.json');
  if (!fs.existsSync(errorFile)) return null;
  return JSON.parse(fs.readFileSync(errorFile, 'utf8'));
}

/**
 * Move a dead-letter run back to the data directory for re-execution.
 */
export function replayRun(runId: string, options: ReplayOptions): void {
  const { dataDir, deadLetterDir } = options;
  const srcDir = path.join(deadLetterDir, `run-${runId}`);
  const destDir = path.join(dataDir, `run-${runId}`);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Dead letter run not found: ${runId}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.renameSync(srcDir, destDir);
}

/**
 * Purge dead-letter entries older than maxAgeDays.
 */
export function purgeDeadLetter(maxAgeDays: number, deadLetterDir: string): void {
  if (!fs.existsSync(deadLetterDir)) return;

  const cutoffMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (const entry of fs.readdirSync(deadLetterDir)) {
    const fullPath = path.join(deadLetterDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const errorFile = path.join(fullPath, '_error.json');
    if (!fs.existsSync(errorFile)) continue;

    try {
      const annotation = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
      const age = Date.now() - new Date(annotation.timestamp).getTime();
      if (age > cutoffMs) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Skip entries with corrupted error files
    }
  }
}
