import type Database from 'better-sqlite3';

export interface CreateQAScoreInput {
  readonly runId: string;
  readonly topicId: string;
  readonly overallScore: number;
  readonly verdict: string;
  readonly dimensionsJson: string;
  readonly createdAt: string;
}

export interface QAScore {
  readonly id: number;
  readonly runId: string;
  readonly topicId: string;
  readonly overallScore: number;
  readonly verdict: string;
  readonly dimensionsJson: string;
  readonly createdAt: string;
}

interface QAScoreRow {
  id: number;
  run_id: string;
  topic_id: string;
  overall_score: number;
  verdict: string;
  dimensions_json: string;
  created_at: string;
}

function rowToModel(row: QAScoreRow): QAScore {
  return {
    id: row.id,
    runId: row.run_id,
    topicId: row.topic_id,
    overallScore: row.overall_score,
    verdict: row.verdict,
    dimensionsJson: row.dimensions_json,
    createdAt: row.created_at,
  };
}

export function createQAScore(
  db: Database.Database,
  input: CreateQAScoreInput,
): void {
  db.prepare(
    `INSERT INTO qa_scores (run_id, topic_id, overall_score, verdict, dimensions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.runId,
    input.topicId,
    input.overallScore,
    input.verdict,
    input.dimensionsJson,
    input.createdAt,
  );
}

export function getQAScoreForRun(
  db: Database.Database,
  runId: string,
): QAScore | undefined {
  const row = db
    .prepare('SELECT * FROM qa_scores WHERE run_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(runId) as QAScoreRow | undefined;
  return row ? rowToModel(row) : undefined;
}

export function getQAScoresByRun(
  db: Database.Database,
  runId: string,
): readonly QAScore[] {
  const rows = db
    .prepare('SELECT * FROM qa_scores WHERE run_id = ? ORDER BY created_at DESC')
    .all(runId) as QAScoreRow[];
  return rows.map(rowToModel);
}

export function getLatestQAScores(
  db: Database.Database,
  limit: number = 10,
): readonly QAScore[] {
  const rows = db
    .prepare('SELECT * FROM qa_scores ORDER BY created_at DESC LIMIT ?')
    .all(limit) as QAScoreRow[];
  return rows.map(rowToModel);
}
