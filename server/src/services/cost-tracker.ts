import type Database from 'better-sqlite3';

interface CostRecord {
  readonly runId: string;
  readonly agentName: string;
  readonly service: string;
  readonly tokensUsed: number;
  readonly costUsd: number;
}

export function recordCost(db: Database.Database, record: CostRecord): void {
  db.prepare(
    `INSERT INTO api_costs (run_id, agent_name, service, tokens_used, estimated_cost_usd, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    record.runId,
    record.agentName,
    record.service,
    record.tokensUsed,
    record.costUsd,
    new Date().toISOString(),
  );
}

export function getDailyCost(db: Database.Database): number {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM api_costs
       WHERE created_at >= ?`,
    )
    .get(`${todayPrefix}T00:00:00`) as { total: number };
  return row.total;
}

export function getMonthlyCost(db: Database.Database): number {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM api_costs
       WHERE created_at >= ?`,
    )
    .get(`${monthPrefix}-01T00:00:00`) as { total: number };
  return row.total;
}

interface BudgetLimits {
  readonly dailyLimitUsd: number;
  readonly monthlyLimitUsd: number;
}

export function isWithinBudget(
  db: Database.Database,
  limits: BudgetLimits,
): boolean {
  const daily = getDailyCost(db);
  const monthly = getMonthlyCost(db);
  return daily <= limits.dailyLimitUsd && monthly <= limits.monthlyLimitUsd;
}

export class CostService {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isWithinBudget(limits?: BudgetLimits): boolean {
    const resolved: BudgetLimits = limits ?? {
      dailyLimitUsd: parseFloat(process.env.DAILY_BUDGET_USD ?? '5'),
      monthlyLimitUsd: parseFloat(process.env.MONTHLY_BUDGET_USD ?? '100'),
    };
    return isWithinBudget(this.db, resolved);
  }
}
