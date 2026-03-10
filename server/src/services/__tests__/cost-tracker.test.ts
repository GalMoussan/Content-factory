import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  recordCost,
  getDailyCost,
  getMonthlyCost,
  isWithinBudget,
  CostService,
} from '../cost-tracker';

// T026 — Cost Tracking and Budget Limits
// Tests will fail at import until cost-tracker.ts is implemented.

function makeInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      service TEXT NOT NULL,
      tokens_used INTEGER,
      estimated_cost_usd REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

describe('T026 — Cost Tracking and Budget Limits', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeInMemoryDb();
  });

  // Acceptance: "Per-run, per-agent API costs recorded in SQLite"
  it('should insert a cost record with all required fields', () => {
    recordCost(db, {
      runId: 'run-001',
      agentName: 'ContentProducer',
      service: 'claude',
      tokensUsed: 5000,
      costUsd: 0.075,
    });

    const row = db.prepare('SELECT * FROM api_costs WHERE run_id = ?').get('run-001') as {
      agent_name: string;
      service: string;
      tokens_used: number;
      estimated_cost_usd: number;
    };

    expect(row).toBeDefined();
    expect(row.agent_name).toBe('ContentProducer');
    expect(row.service).toBe('claude');
    expect(row.tokens_used).toBe(5000);
    expect(row.estimated_cost_usd).toBeCloseTo(0.075);
  });

  // Acceptance: "Daily cost aggregation query"
  it('should return the sum of all costs recorded today', () => {
    const today = new Date().toISOString();
    db.prepare(
      'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'ContentProducer', 'claude', 3000, 0.045, today);
    db.prepare(
      'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r1', 'ContentProducer', 'azure_tts', 0, 0.03, today);

    const daily = getDailyCost(db);
    expect(daily).toBeCloseTo(0.075);
  });

  it('should exclude costs from previous days in the daily total', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    db.prepare(
      'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r-old', 'QualityController', 'claude', 2000, 0.03, yesterday);

    const daily = getDailyCost(db);
    expect(daily).toBe(0);
  });

  // Acceptance: "Monthly cost aggregation query"
  it('should sum all costs within the current calendar month', () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      db.prepare(
        'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(`r${i}`, 'ContentProducer', 'claude', 1000, 0.015, now);
    }

    const monthly = getMonthlyCost(db);
    expect(monthly).toBeCloseTo(0.075);
  });

  // Acceptance: "Configurable daily and monthly budget limits"
  it('should return true when daily cost is below the daily limit', () => {
    const within = isWithinBudget(db, { dailyLimitUsd: 1.0, monthlyLimitUsd: 20.0 });
    expect(within).toBe(true);
  });

  // Acceptance: "Pipeline blocked when budget exceeded"
  it('should return false when daily cost has exceeded the configured limit', () => {
    const today = new Date().toISOString();
    db.prepare(
      'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('r-big', 'ContentProducer', 'claude', 100_000, 5.0, today);

    const within = isWithinBudget(db, { dailyLimitUsd: 1.0, monthlyLimitUsd: 20.0 });
    expect(within).toBe(false);
  });

  it('should return false when monthly cost has exceeded the configured limit', () => {
    const today = new Date().toISOString();
    // Add 21 runs at $1 each — over the $20 monthly cap
    for (let i = 0; i < 21; i++) {
      db.prepare(
        'INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(`run-${i}`, 'ContentProducer', 'claude', 60_000, 1.0, today);
    }

    const within = isWithinBudget(db, { dailyLimitUsd: 100.0, monthlyLimitUsd: 20.0 });
    expect(within).toBe(false);
  });

  // Acceptance: "CostService class interface (used by pipeline-guard)"
  it('CostService.isWithinBudget should use env-configured limits when none are passed', () => {
    const service = new CostService(db);
    // Just verify it runs without throwing and returns a boolean
    expect(typeof service.isWithinBudget()).toBe('boolean');
  });
});
