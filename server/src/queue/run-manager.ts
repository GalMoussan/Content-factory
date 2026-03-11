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

interface MoveToDeadLetterOptions {
  readonly agentName: string;
  readonly retryAttempts: number;
  readonly dataDir: string;
  readonly deadLetterDir: string;
}

/**
 * Move a failed run directory to the dead-letter queue and annotate with error info.
 * Supports two call signatures:
 *   moveToDeadLetter(srcDir, runId, errorMessage, deadLetterDir)  — legacy
 *   moveToDeadLetter(runId, error, options)                        — new
 */
export function moveToDeadLetter(
  srcDirOrRunId: string,
  runIdOrError: string | Error,
  errorMsgOrOptions: string | MoveToDeadLetterOptions,
  deadLetterDirLegacy?: string,
): void {
  if (typeof errorMsgOrOptions === 'string' && deadLetterDirLegacy) {
    // Legacy: moveToDeadLetter(srcDir, runId, errorMessage, deadLetterDir)
    const srcDir = srcDirOrRunId;
    const runId = runIdOrError as string;
    const errorMessage = errorMsgOrOptions;
    const deadLetterDir = deadLetterDirLegacy;

    const destDir = path.join(deadLetterDir, runId);
    fs.mkdirSync(deadLetterDir, { recursive: true });
    fs.renameSync(srcDir, destDir);

    const errorAnnotation = {
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(destDir, '_error.json'),
      JSON.stringify(errorAnnotation, null, 2),
      'utf8',
    );
  } else {
    // New: moveToDeadLetter(runId, error, options)
    const runId = srcDirOrRunId;
    const error = runIdOrError as Error;
    const options = errorMsgOrOptions as MoveToDeadLetterOptions;
    const { agentName, retryAttempts, dataDir, deadLetterDir } = options;
    const srcDir = path.join(dataDir, `run-${runId}`);
    const destDir = path.join(deadLetterDir, `run-${runId}`);

    fs.mkdirSync(deadLetterDir, { recursive: true });
    fs.renameSync(srcDir, destDir);

    const errorAnnotation = {
      agentName,
      retryAttempts,
      error: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(destDir, '_error.json'),
      JSON.stringify(errorAnnotation, null, 2),
      'utf8',
    );
  }
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
