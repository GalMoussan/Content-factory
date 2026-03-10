import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { cleanupOldRuns, cleanupDeadLetter, getDiskUsage, getRetentionStats } from '../disk-manager';

// T025 — Disk Space Management and Retention
// Tests will fail at import until disk-manager.ts is implemented.

const BASE_DIR = path.join(os.tmpdir(), `disk-mgr-test-${process.pid}`);
const DATA_DIR = path.join(BASE_DIR, 'data');
const DLQ_DIR = path.join(BASE_DIR, 'dead-letter');

function makeRunDir(name: string, ageDays: number): void {
  const dir = path.join(DATA_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  const meta = { createdAt: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString() };
  fs.writeFileSync(path.join(dir, '_meta.json'), JSON.stringify(meta), 'utf8');
  // Simulate a video file (~1 KB content for test purposes)
  fs.writeFileSync(path.join(dir, 'video.mp4'), Buffer.alloc(1024));
}

function makeDeadLetterDir(name: string, ageDays: number): void {
  const dir = path.join(DLQ_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  const errorAnnotation = {
    timestamp: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString(),
  };
  fs.writeFileSync(path.join(dir, '_error.json'), JSON.stringify(errorAnnotation), 'utf8');
}

describe('T025 — Disk Space Management and Retention', () => {
  beforeEach(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(DLQ_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(BASE_DIR, { recursive: true, force: true });
  });

  // Acceptance: "Old run directories deleted based on configurable retention period"
  it('should delete run directories older than maxAgeDays', () => {
    makeRunDir('old-run', 35);   // older than 30-day default
    makeRunDir('fresh-run', 5);  // recent

    cleanupOldRuns(30, DATA_DIR);

    expect(fs.existsSync(path.join(DATA_DIR, 'old-run'))).toBe(false);
    expect(fs.existsSync(path.join(DATA_DIR, 'fresh-run'))).toBe(true);
  });

  it('should not delete runs within the retention window', () => {
    makeRunDir('keep-run', 10);

    cleanupOldRuns(30, DATA_DIR);

    expect(fs.existsSync(path.join(DATA_DIR, 'keep-run'))).toBe(true);
  });

  // Acceptance: "Dead letter entries have separate (longer) retention"
  it('should delete dead letter entries older than the DLQ maxAgeDays threshold', () => {
    makeDeadLetterDir('old-dlq', 95);   // older than 90-day default
    makeDeadLetterDir('fresh-dlq', 10); // recent

    cleanupDeadLetter(90, DLQ_DIR);

    expect(fs.existsSync(path.join(DLQ_DIR, 'old-dlq'))).toBe(false);
    expect(fs.existsSync(path.join(DLQ_DIR, 'fresh-dlq'))).toBe(true);
  });

  // Acceptance: "Disk usage reporting via API"
  it('should return total disk usage in bytes for the queue directory', () => {
    makeRunDir('run-a', 1);
    makeRunDir('run-b', 2);

    const usage = getDiskUsage(BASE_DIR);
    expect(typeof usage.totalBytes).toBe('number');
    expect(usage.totalBytes).toBeGreaterThan(0);
  });

  it('should include a human-readable size string in getDiskUsage result', () => {
    makeRunDir('run-c', 1);

    const usage = getDiskUsage(BASE_DIR);
    expect(typeof usage.humanReadable).toBe('string');
    expect(usage.humanReadable).toMatch(/B|KB|MB|GB/i);
  });

  // Acceptance: "Cleanup logged with counts and freed space"
  it('should return cleanup stats including the count of deleted runs', () => {
    makeRunDir('del-1', 40);
    makeRunDir('del-2', 50);
    makeRunDir('keep-1', 5);

    const stats = cleanupOldRuns(30, DATA_DIR);

    expect(stats.deletedCount).toBe(2);
    expect(typeof stats.freedBytes).toBe('number');
  });

  // Acceptance: "getRetentionStats reports counts by age bracket"
  it('should return run counts grouped by age brackets', () => {
    makeRunDir('br-1-day', 1);
    makeRunDir('br-15-day', 15);
    makeRunDir('br-45-day', 45);

    const stats = getRetentionStats(DATA_DIR);

    expect(stats).toHaveProperty('last7Days');
    expect(stats).toHaveProperty('last30Days');
    expect(stats).toHaveProperty('older');
    expect(stats.last7Days).toBe(1);
    expect(stats.older).toBe(1);
  });
});
