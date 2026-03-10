import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { registerRoutes } from '../index';

// T018 — Express Server and API Routes
// Tests will fail at import until route modules are implemented.

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      failed_agent TEXT,
      trigger TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS agent_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS qa_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      overall_score REAL NOT NULL,
      verdict TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS publish_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      youtube_id TEXT,
      title TEXT,
      status TEXT NOT NULL,
      published_at TEXT
    );
    CREATE TABLE IF NOT EXISTS circuit_breaker (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT NOT NULL DEFAULT 'CLOSED',
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      opened_at TEXT,
      last_failure_at TEXT
    );
    INSERT OR IGNORE INTO circuit_breaker (id) VALUES (1);
  `);
  return db;
}

let app: Express;
let db: Database.Database;

beforeAll(() => {
  db = makeInMemoryDb();
  app = express();
  app.use(express.json());
  registerRoutes(app, { db });
});

describe('T018 — Express API Routes', () => {
  // Acceptance: "All endpoints from API reference are implemented"
  describe('GET /api/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('GET /api/pipeline/runs', () => {
    it('should return a paginated list of pipeline runs', async () => {
      const res = await request(app).get('/api/pipeline/runs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('should support page and limit query params', async () => {
      const res = await request(app).get('/api/pipeline/runs?page=1&limit=5');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/pipeline/runs/:id', () => {
    it('should return 404 for a non-existent run ID', async () => {
      const res = await request(app).get('/api/pipeline/runs/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/pipeline/status', () => {
    it('should return current pipeline status (idle when no active run)', async () => {
      const res = await request(app).get('/api/pipeline/status');
      expect(res.status).toBe(200);
      expect(['idle', 'running']).toContain(res.body.status);
    });
  });

  // Acceptance: "Pipeline trigger returns 409 when busy"
  describe('POST /api/pipeline/trigger', () => {
    it('should return 409 when a pipeline run is already active', async () => {
      db.prepare(
        "INSERT INTO pipeline_runs (id, status, started_at) VALUES ('active-run', 'running', ?)",
      ).run(new Date().toISOString());

      const res = await request(app).post('/api/pipeline/trigger');
      expect(res.status).toBe(409);

      db.prepare("DELETE FROM pipeline_runs WHERE id = 'active-run'").run();
    });

    it('should return 202 when the pipeline can be started', async () => {
      const res = await request(app).post('/api/pipeline/trigger');
      // 202 Accepted (async) or 200; must not be 4xx/5xx in idle state
      expect(res.status).toBeLessThan(400);
    });
  });

  // Acceptance: "Consistent error response format with error codes"
  describe('GET /api/pipeline/runs/:id/logs', () => {
    it('should return 404 with an error code field for missing run', async () => {
      const res = await request(app).get('/api/pipeline/runs/ghost-run/logs');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/qa/scores', () => {
    it('should return a paginated list of QA scores', async () => {
      const res = await request(app).get('/api/qa/scores');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/publish/history', () => {
    it('should return a paginated publish history list', async () => {
      const res = await request(app).get('/api/publish/history');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // Acceptance: "Rate limiting on POST endpoints"
  describe('POST /api/circuit-breaker/reset', () => {
    it('should return 200 when resetting the circuit breaker', async () => {
      const res = await request(app).post('/api/circuit-breaker/reset');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/circuit-breaker/status', () => {
    it('should return current circuit breaker state', async () => {
      const res = await request(app).get('/api/circuit-breaker/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('state');
    });
  });

  describe('GET /api/metrics', () => {
    it('should return pipeline metrics with success rate and cost data', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('successRate');
    });
  });
});
