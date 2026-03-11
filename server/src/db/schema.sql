-- ContentFactory — SQLite Schema
-- All timestamps stored as ISO 8601 strings.

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'running',
  started_at    TEXT NOT NULL,
  completed_at  TEXT,
  failed_agent  TEXT,
  trigger       TEXT NOT NULL DEFAULT 'manual',
  triggered_by  TEXT NOT NULL DEFAULT 'manual'
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
  topic_id        TEXT NOT NULL DEFAULT '',
  overall_score   REAL NOT NULL,
  verdict         TEXT NOT NULL,
  dimensions_json TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publish_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id           TEXT NOT NULL REFERENCES pipeline_runs(id),
  topic_id         TEXT NOT NULL DEFAULT '',
  youtube_video_id TEXT,
  youtube_url      TEXT,
  youtube_id       TEXT,
  title            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL,
  scheduled_at     TEXT,
  published_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS api_costs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id              TEXT NOT NULL,
  agent_name          TEXT NOT NULL,
  service             TEXT NOT NULL,
  tokens_used         INTEGER,
  estimated_cost_usd  REAL NOT NULL,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS circuit_breaker (
  id                    INTEGER PRIMARY KEY CHECK(id = 1),
  state                 TEXT NOT NULL DEFAULT 'CLOSED',
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,
  last_failure_at       TEXT,
  last_success_at       TEXT,
  opened_at             TEXT
);

-- Views for route compatibility (routes test uses alternate table names)
CREATE VIEW IF NOT EXISTS qa_results AS SELECT * FROM qa_scores;
CREATE VIEW IF NOT EXISTS publish_history AS SELECT id, run_id, youtube_id, title, status, published_at FROM publish_log;

-- Seed the singleton circuit-breaker row
INSERT OR IGNORE INTO circuit_breaker (id) VALUES (1);
