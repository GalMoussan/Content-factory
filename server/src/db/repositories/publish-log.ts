import type Database from 'better-sqlite3';

export interface CreatePublishLogInput {
  readonly runId: string;
  readonly topicId: string;
  readonly title: string;
  readonly status: string;
  readonly youtubeVideoId?: string;
  readonly youtubeUrl?: string;
  readonly scheduledAt?: string;
  readonly createdAt: string;
}

export interface PublishLog {
  readonly id: number;
  readonly runId: string;
  readonly topicId: string;
  readonly youtubeVideoId: string | null;
  readonly youtubeUrl: string | null;
  readonly title: string;
  readonly status: string;
  readonly scheduledAt: string | null;
  readonly createdAt: string;
}

interface PublishLogRow {
  id: number;
  run_id: string;
  topic_id: string;
  youtube_video_id: string | null;
  youtube_url: string | null;
  title: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}

function rowToModel(row: PublishLogRow): PublishLog {
  return {
    id: row.id,
    runId: row.run_id,
    topicId: row.topic_id,
    youtubeVideoId: row.youtube_video_id,
    youtubeUrl: row.youtube_url,
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
  };
}

export function createPublishLog(
  db: Database.Database,
  input: CreatePublishLogInput,
): void {
  db.prepare(
    `INSERT INTO publish_log (run_id, topic_id, youtube_video_id, youtube_url, title, status, scheduled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.runId,
    input.topicId,
    input.youtubeVideoId ?? null,
    input.youtubeUrl ?? null,
    input.title,
    input.status,
    input.scheduledAt ?? null,
    input.createdAt,
  );
}

export function getPublishLogForRun(
  db: Database.Database,
  runId: string,
): PublishLog | undefined {
  const row = db
    .prepare('SELECT * FROM publish_log WHERE run_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(runId) as PublishLogRow | undefined;
  return row ? rowToModel(row) : undefined;
}

export function updatePublishLogStatus(
  db: Database.Database,
  id: number,
  status: string,
): void {
  db.prepare('UPDATE publish_log SET status = ? WHERE id = ?').run(status, id);
}

export function getPublishHistory(
  db: Database.Database,
  options?: { limit?: number; offset?: number },
): readonly PublishLog[] {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;
  const rows = db
    .prepare('SELECT * FROM publish_log ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as PublishLogRow[];
  return rows.map(rowToModel);
}

export function getPublishByRun(
  db: Database.Database,
  runId: string,
): readonly PublishLog[] {
  const rows = db
    .prepare('SELECT * FROM publish_log WHERE run_id = ? ORDER BY created_at DESC')
    .all(runId) as PublishLogRow[];
  return rows.map(rowToModel);
}
