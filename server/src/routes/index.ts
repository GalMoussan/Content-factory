import type { Express } from 'express';
import type Database from 'better-sqlite3';
import {
  getCircuitBreakerState,
  resetCircuitBreaker as resetCB,
} from '../core/circuit-breaker.js';

interface RouteDeps {
  readonly db: Database.Database;
}

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function registerRoutes(app: Express, deps: RouteDeps): void {
  const { db } = deps;

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Pipeline runs (paginated)
  app.get('/api/pipeline/runs', (req, res) => {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const total = (db.prepare('SELECT COUNT(*) as count FROM pipeline_runs').get() as { count: number }).count;
    const data = db.prepare('SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json({ data, total });
  });

  // Single pipeline run
  app.get('/api/pipeline/runs/:id', (req, res) => {
    const run = db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  });

  // Pipeline status
  app.get('/api/pipeline/status', (_req, res) => {
    const running = db.prepare("SELECT * FROM pipeline_runs WHERE status = 'running' LIMIT 1").get() as Record<string, unknown> | undefined;
    if (running) {
      res.json({ status: 'running', runId: running.id });
    } else {
      res.json({ status: 'idle' });
    }
  });

  // Trigger pipeline
  app.post('/api/pipeline/trigger', (_req, res) => {
    const running = (db.prepare("SELECT COUNT(*) as count FROM pipeline_runs WHERE status = 'running'").get() as { count: number });
    if (running.count > 0) {
      res.status(409).json({ error: 'Pipeline is already running' });
      return;
    }
    const runId = `run-${Date.now()}`;
    db.prepare("INSERT INTO pipeline_runs (id, status, started_at, trigger) VALUES (?, 'queued', ?, 'manual')").run(runId, new Date().toISOString());
    res.status(202).json({ runId });
  });

  // Run logs
  app.get('/api/pipeline/runs/:id/logs', (req, res) => {
    const run = db.prepare('SELECT * FROM pipeline_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    const logs = db.prepare('SELECT * FROM agent_executions WHERE run_id = ? ORDER BY started_at ASC').all(req.params.id);
    res.json({ runId: req.params.id, logs });
  });

  // QA scores (paginated)
  app.get('/api/qa/scores', (req, res) => {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const verdict = req.query.verdict as string | undefined;
    let total: number;
    let data: unknown[];
    if (verdict) {
      total = (db.prepare('SELECT COUNT(*) as count FROM qa_results WHERE verdict = ?').get(verdict) as { count: number }).count;
      data = db.prepare('SELECT * FROM qa_results WHERE verdict = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(verdict, limit, offset);
    } else {
      total = (db.prepare('SELECT COUNT(*) as count FROM qa_results').get() as { count: number }).count;
      data = db.prepare('SELECT * FROM qa_results ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    }
    res.json({ data, total });
  });

  // Publish history (paginated)
  app.get('/api/publish/history', (req, res) => {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const total = (db.prepare('SELECT COUNT(*) as count FROM publish_history').get() as { count: number }).count;
    const data = db.prepare('SELECT * FROM publish_history ORDER BY published_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    res.json({ data, total });
  });

  // Circuit breaker status
  app.get('/api/circuit-breaker/status', (_req, res) => {
    const state = getCircuitBreakerState(db);
    res.json(state);
  });

  // Circuit breaker reset
  app.post('/api/circuit-breaker/reset', (_req, res) => {
    resetCB(db);
    res.json({ success: true });
  });

  // Metrics
  app.get('/api/metrics', (_req, res) => {
    const total = (db.prepare('SELECT COUNT(*) as count FROM pipeline_runs').get() as { count: number }).count;
    const completed = (db.prepare("SELECT COUNT(*) as count FROM pipeline_runs WHERE status = 'completed'").get() as { count: number }).count;
    const successRate = total > 0 ? completed / total : 0;
    res.json({ successRate, totalRuns: total, completedRuns: completed });
  });
}
