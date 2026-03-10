import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { writeQueueFileAtomic } from '../atomic-write';
import { readQueueFile } from '../reader';
import { writeQueueFile } from '../writer';
import {
  createRunDir,
  writeRunMeta,
  moveToDeadLetter,
  listRuns,
  cleanupOldRuns,
} from '../run-manager';
import { getRunDir, getAssetsDir, QUEUE_DATA_DIR, QUEUE_DEAD_LETTER_DIR } from '../paths';

// T004 — JSON Queue System
// Tests will fail at import until queue modules are implemented.

let tmpBase: string;

beforeEach(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-queue-test-'));
});

afterEach(() => {
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------
describe('T004 — Path helpers', () => {
  // Acceptance: "Run directories follow queue/data/run-{uuid}/ pattern"
  it('should build the correct run directory path', () => {
    const runId = 'abc-123';
    const runDir = getRunDir(runId);
    expect(runDir).toMatch(/queue\/data\/run-abc-123/);
  });

  it('should build the correct assets directory path', () => {
    const runId = 'abc-123';
    const assetsDir = getAssetsDir(runId);
    expect(assetsDir).toMatch(/queue\/data\/run-abc-123\/assets/);
  });

  it('should export QUEUE_DATA_DIR and QUEUE_DEAD_LETTER_DIR constants', () => {
    expect(typeof QUEUE_DATA_DIR).toBe('string');
    expect(typeof QUEUE_DEAD_LETTER_DIR).toBe('string');
    expect(QUEUE_DATA_DIR).toContain('queue/data');
    expect(QUEUE_DEAD_LETTER_DIR).toContain('queue/dead-letter');
  });
});

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------
describe('T004 — writeQueueFileAtomic', () => {
  // Acceptance: "Atomic writes use write-tmp-rename pattern (never partial files)"
  it('should write a file to the specified directory', () => {
    const data = { message: 'hello', count: 42 };
    writeQueueFileAtomic(tmpBase, 'test.json', data);

    const filePath = path.join(tmpBase, 'test.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(parsed).toEqual(data);
  });

  it('should not leave a .tmp file behind after a successful write', () => {
    writeQueueFileAtomic(tmpBase, 'topics.json', { topics: [] });

    const files = fs.readdirSync(tmpBase);
    const tmpFiles = files.filter((f) => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('should overwrite an existing file atomically', () => {
    writeQueueFileAtomic(tmpBase, 'data.json', { v: 1 });
    writeQueueFileAtomic(tmpBase, 'data.json', { v: 2 });

    const content = JSON.parse(fs.readFileSync(path.join(tmpBase, 'data.json'), 'utf8'));
    expect(content.v).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Queue reader
// ---------------------------------------------------------------------------
describe('T004 — readQueueFile', () => {
  const TestSchema = z.object({ name: z.string(), value: z.number() });

  it('should read and parse a valid JSON file against a Zod schema', () => {
    const data = { name: 'test', value: 99 };
    fs.writeFileSync(path.join(tmpBase, 'data.json'), JSON.stringify(data));

    const result = readQueueFile(tmpBase, 'data.json', TestSchema);
    expect(result).toEqual(data);
  });

  // Acceptance: "readQueueFile throws ZodError on invalid data"
  it('should throw ZodError when file content does not match schema', () => {
    const invalid = { name: 'test', value: 'not-a-number' };
    fs.writeFileSync(path.join(tmpBase, 'data.json'), JSON.stringify(invalid));

    expect(() => readQueueFile(tmpBase, 'data.json', TestSchema)).toThrow(ZodError);
  });

  it('should throw an error when the file does not exist', () => {
    expect(() => readQueueFile(tmpBase, 'nonexistent.json', TestSchema)).toThrow();
  });

  it('should throw when the file contains malformed JSON', () => {
    fs.writeFileSync(path.join(tmpBase, 'bad.json'), '{ broken json ,,, }');
    expect(() => readQueueFile(tmpBase, 'bad.json', TestSchema)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Queue writer
// ---------------------------------------------------------------------------
describe('T004 — writeQueueFile', () => {
  const PayloadSchema = z.object({ topicId: z.string(), score: z.number().min(0).max(100) });

  // Acceptance: "writeQueueFile validates data before writing"
  it('should write valid data to the queue file', () => {
    const data = { topicId: 'topic-001', score: 85 };
    writeQueueFile(tmpBase, 'topics.json', data, PayloadSchema);

    const written = JSON.parse(fs.readFileSync(path.join(tmpBase, 'topics.json'), 'utf8'));
    expect(written).toEqual(data);
  });

  it('should throw ZodError and NOT write a file when data is invalid', () => {
    const invalid = { topicId: 'topic-001', score: 150 };
    expect(() => writeQueueFile(tmpBase, 'topics.json', invalid, PayloadSchema)).toThrow(ZodError);

    expect(fs.existsSync(path.join(tmpBase, 'topics.json'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Run manager
// ---------------------------------------------------------------------------
describe('T004 — Run manager', () => {
  it('should create the run directory and assets subdirectory', () => {
    const runId = 'run-test-001';
    const runDir = path.join(tmpBase, `run-${runId}`);

    createRunDir(runDir);

    expect(fs.existsSync(runDir)).toBe(true);
    expect(fs.existsSync(path.join(runDir, 'assets'))).toBe(true);
  });

  it('should write a _meta.json file in the run directory', () => {
    const runDir = path.join(tmpBase, 'run-001');
    fs.mkdirSync(runDir, { recursive: true });

    const meta = { runId: 'run-001', status: 'running', triggeredBy: 'manual', startedAt: new Date().toISOString() };
    writeRunMeta(runDir, meta);

    const written = JSON.parse(fs.readFileSync(path.join(runDir, '_meta.json'), 'utf8'));
    expect(written.runId).toBe('run-001');
    expect(written.status).toBe('running');
  });

  // Acceptance: "Dead letter moves entire run directory with _error.json annotation"
  it('should move run directory to dead-letter and add _error.json', () => {
    const runDir = path.join(tmpBase, 'run-002');
    const deadLetterDir = path.join(tmpBase, 'dead-letter');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'topics.json'), JSON.stringify({ topics: [] }));

    moveToDeadLetter(runDir, 'run-002', 'Agent crashed', deadLetterDir);

    expect(fs.existsSync(runDir)).toBe(false);
    const movedDir = path.join(deadLetterDir, 'run-002');
    expect(fs.existsSync(movedDir)).toBe(true);
    expect(fs.existsSync(path.join(movedDir, 'topics.json'))).toBe(true);
    expect(fs.existsSync(path.join(movedDir, '_error.json'))).toBe(true);

    const error = JSON.parse(fs.readFileSync(path.join(movedDir, '_error.json'), 'utf8'));
    expect(error.message).toBe('Agent crashed');
  });

  it('should list all run directories', () => {
    const dataDir = path.join(tmpBase, 'data');
    fs.mkdirSync(path.join(dataDir, 'run-a'), { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'run-b'), { recursive: true });

    const runs = listRuns(dataDir);
    expect(runs.length).toBe(2);
  });

  // Acceptance: "cleanupOldRuns respects age threshold"
  it('should delete run directories older than the specified max age', () => {
    const dataDir = path.join(tmpBase, 'data');
    const oldDir = path.join(dataDir, 'run-old');
    const newDir = path.join(dataDir, 'run-new');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.mkdirSync(newDir, { recursive: true });

    // Back-date the old directory's mtime to 10 days ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldDir, tenDaysAgo, tenDaysAgo);

    cleanupOldRuns(dataDir, 5 /* maxAgeDays */);

    expect(fs.existsSync(oldDir)).toBe(false);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('should NOT delete run directories newer than the max age', () => {
    const dataDir = path.join(tmpBase, 'data');
    const recentDir = path.join(dataDir, 'run-recent');
    fs.mkdirSync(recentDir, { recursive: true });

    cleanupOldRuns(dataDir, 30 /* maxAgeDays */);

    expect(fs.existsSync(recentDir)).toBe(true);
  });
});
