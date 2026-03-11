import fs from 'node:fs';
import path from 'node:path';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface CleanupStats {
  readonly deletedCount: number;
  readonly freedBytes: number;
}

function getDirSize(dirPath: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function getRunAgeDays(dirPath: string): number {
  const metaPath = path.join(dirPath, '_meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { createdAt?: string };
      if (typeof meta.createdAt === 'string') {
        const ms = new Date(meta.createdAt).getTime();
        if (Number.isFinite(ms)) {
          return (Date.now() - ms) / MS_PER_DAY;
        }
      }
    } catch {
      // Corrupted JSON — fall through to mtime fallback
    }
  }
  return (Date.now() - fs.statSync(dirPath).mtimeMs) / MS_PER_DAY;
}

function getDlqAgeDays(dirPath: string): number {
  const errorPath = path.join(dirPath, '_error.json');
  if (fs.existsSync(errorPath)) {
    try {
      const annotation = JSON.parse(fs.readFileSync(errorPath, 'utf8')) as { timestamp?: string };
      if (typeof annotation.timestamp === 'string') {
        const ms = new Date(annotation.timestamp).getTime();
        if (Number.isFinite(ms)) {
          return (Date.now() - ms) / MS_PER_DAY;
        }
      }
    } catch {
      // Corrupted JSON — fall through to mtime fallback
    }
  }
  return (Date.now() - fs.statSync(dirPath).mtimeMs) / MS_PER_DAY;
}

function cleanupDirectory(
  dir: string,
  maxAgeDays: number,
  getAgeFn: (dirPath: string) => number,
): CleanupStats {
  if (!fs.existsSync(dir)) return { deletedCount: 0, freedBytes: 0 };

  let deletedCount = 0;
  let freedBytes = 0;

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    try {
      const ageDays = getAgeFn(fullPath);
      if (ageDays > maxAgeDays) {
        freedBytes += getDirSize(fullPath);
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedCount++;
      }
    } catch {
      // Skip directories that can't be processed — don't abort the whole pass
    }
  }

  return { deletedCount, freedBytes };
}

export function cleanupOldRuns(maxAgeDays: number, dataDir: string): CleanupStats {
  return cleanupDirectory(dataDir, maxAgeDays, getRunAgeDays);
}

export function cleanupDeadLetter(maxAgeDays: number, dlqDir: string): CleanupStats {
  return cleanupDirectory(dlqDir, maxAgeDays, getDlqAgeDays);
}

interface DiskUsage {
  readonly totalBytes: number;
  readonly humanReadable: string;
}

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

export function getDiskUsage(baseDir: string): DiskUsage {
  const totalBytes = fs.existsSync(baseDir) ? getDirSize(baseDir) : 0;
  return { totalBytes, humanReadable: formatBytes(totalBytes) };
}

interface RetentionStats {
  readonly last7Days: number;
  readonly last30Days: number;
  readonly older: number;
}

export function getRetentionStats(dataDir: string): RetentionStats {
  if (!fs.existsSync(dataDir)) return { last7Days: 0, last30Days: 0, older: 0 };

  let last7Days = 0;
  let last30Days = 0;
  let older = 0;

  for (const entry of fs.readdirSync(dataDir)) {
    const fullPath = path.join(dataDir, entry);
    if (!fs.statSync(fullPath).isDirectory()) continue;

    const ageDays = getRunAgeDays(fullPath);
    if (ageDays <= 7) {
      last7Days++;
    } else if (ageDays <= 30) {
      last30Days++;
    } else {
      older++;
    }
  }

  return { last7Days, last30Days, older };
}
