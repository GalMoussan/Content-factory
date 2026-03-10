import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { moveToDeadLetter } from '../run-manager';
import {
  listDeadLetterRuns,
  getDeadLetterError,
  replayRun,
  purgeDeadLetter,
} from '../dead-letter';

// T016 — Dead Letter Queue
// Tests will fail at import until run-manager.ts and dead-letter.ts are implemented.

const BASE_DIR = path.join(os.tmpdir(), `dlq-test-${process.pid}`);
const DATA_DIR = path.join(BASE_DIR, 'data');
const DLQ_DIR = path.join(BASE_DIR, 'dead-letter');

function scaffoldRun(runId: string): void {
  const runDir = path.join(DATA_DIR, `run-${runId}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, '_meta.json'), JSON.stringify({ runId }), 'utf8');
  fs.writeFileSync(path.join(runDir, 'trends.json'), JSON.stringify({ topics: [] }), 'utf8');
}

describe('T016 — Dead Letter Queue', () => {
  beforeEach(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(DLQ_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(BASE_DIR, { recursive: true, force: true });
  });

  // Acceptance: "Failed runs moved to queue/dead-letter/run-{id}/"
  it('should move the run directory to the dead-letter folder', () => {
    scaffoldRun('r001');
    const error = new Error('ContentProducer failed');

    moveToDeadLetter('r001', error, {
      agentName: 'ContentProducer',
      retryAttempts: 2,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });

    expect(fs.existsSync(path.join(DATA_DIR, 'run-r001'))).toBe(false);
    expect(fs.existsSync(path.join(DLQ_DIR, 'run-r001'))).toBe(true);
  });

  // Acceptance: "_error.json contains agent name, error details, retry count"
  it('should write a valid _error.json to the dead-letter run directory', () => {
    scaffoldRun('r002');
    const error = new Error('API rate limited');

    moveToDeadLetter('r002', error, {
      agentName: 'ResearchCrawler',
      retryAttempts: 3,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });

    const errorFile = path.join(DLQ_DIR, 'run-r002', '_error.json');
    expect(fs.existsSync(errorFile)).toBe(true);

    const annotation = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
    expect(annotation.agentName).toBe('ResearchCrawler');
    expect(annotation.retryAttempts).toBe(3);
    expect(annotation.error.message).toBe('API rate limited');
    expect(typeof annotation.timestamp).toBe('string');
  });

  // Acceptance: "All original queue files preserved in dead letter"
  it('should preserve existing queue files in the dead-letter directory', () => {
    scaffoldRun('r003');
    moveToDeadLetter('r003', new Error('fail'), {
      agentName: 'Publisher',
      retryAttempts: 1,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });

    expect(fs.existsSync(path.join(DLQ_DIR, 'run-r003', '_meta.json'))).toBe(true);
    expect(fs.existsSync(path.join(DLQ_DIR, 'run-r003', 'trends.json'))).toBe(true);
  });

  // Acceptance: "listDeadLetterRuns returns all DLQ entries"
  it('should list all runs currently in the dead-letter queue', () => {
    scaffoldRun('r004');
    scaffoldRun('r005');

    moveToDeadLetter('r004', new Error('e1'), {
      agentName: 'TrendScout',
      retryAttempts: 0,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });
    moveToDeadLetter('r005', new Error('e2'), {
      agentName: 'TrendScout',
      retryAttempts: 0,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });

    const entries = listDeadLetterRuns(DLQ_DIR);
    const ids = entries.map((e) => e.runId);
    expect(ids).toContain('r004');
    expect(ids).toContain('r005');
  });

  // Acceptance: "Replay function moves run back to data dir"
  it('should move the run back to data directory on replay', () => {
    scaffoldRun('r006');
    moveToDeadLetter('r006', new Error('oops'), {
      agentName: 'QualityController',
      retryAttempts: 1,
      dataDir: DATA_DIR,
      deadLetterDir: DLQ_DIR,
    });

    replayRun('r006', { fromAgent: 'QualityController', dataDir: DATA_DIR, deadLetterDir: DLQ_DIR });

    expect(fs.existsSync(path.join(DATA_DIR, 'run-r006'))).toBe(true);
    expect(fs.existsSync(path.join(DLQ_DIR, 'run-r006'))).toBe(false);
  });

  // Acceptance: "Purge removes entries older than threshold"
  it('should delete dead-letter entries older than maxAgeDays', () => {
    const oldRunDir = path.join(DLQ_DIR, 'run-old');
    fs.mkdirSync(oldRunDir, { recursive: true });
    fs.writeFileSync(
      path.join(oldRunDir, '_error.json'),
      JSON.stringify({ timestamp: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString() }),
      'utf8',
    );

    const recentRunDir = path.join(DLQ_DIR, 'run-recent');
    fs.mkdirSync(recentRunDir, { recursive: true });
    fs.writeFileSync(
      path.join(recentRunDir, '_error.json'),
      JSON.stringify({ timestamp: new Date().toISOString() }),
      'utf8',
    );

    purgeDeadLetter(90, DLQ_DIR);

    expect(fs.existsSync(oldRunDir)).toBe(false);
    expect(fs.existsSync(recentRunDir)).toBe(true);
  });
});
