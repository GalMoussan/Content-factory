-- ContentFactory T003 — SQLite Schema
-- All timestamps stored as ISO 8601 strings.

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'running',
  started_at  TEXT NOT NULL,
  completed_at TEXT,
  triggered_by TEXT NOT NULL,
  error       TEXT
);

CREATE TABLE IF NOT EXISTS agent_executions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id       TEXT NOT NULL REFERENCES pipeline_runs(id),
  agent_name   TEXT NOT NULL,
  status       TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  duration_ms  INTEGER,
  output_file  TEXT,
  error        TEXT,
  metrics_json TEXT
);

CREATE TABLE IF NOT EXISTS qa_scores (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          TEXT NOT NULL REFERENCES pipeline_runs(id),
  topic_id        TEXT NOT NULL,
  overall_score   REAL NOT NULL,
  verdict         TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publish_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id           TEXT NOT NULL REFERENCES pipeline_runs(id),
  topic_id         TEXT NOT NULL,
  youtube_video_id TEXT,
  youtube_url      TEXT,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL,
  scheduled_at     TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS circuit_breaker (
  id                    INTEGER PRIMARY KEY CHECK(id = 1),
  status                TEXT NOT NULL DEFAULT 'closed',
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  last_failure_at       TEXT,
  last_success_at       TEXT,
  opened_at             TEXT
);

-- Seed the singleton circuit-breaker row
INSERT OR IGNORE INTO circuit_breaker (id) VALUES (1);
