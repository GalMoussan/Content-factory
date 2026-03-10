import Database from 'better-sqlite3';

let singleton: Database.Database | null = null;

/**
 * Configure pragmas on an existing better-sqlite3 Database instance:
 * WAL journal mode, busy_timeout = 5000ms, foreign_keys ON.
 */
export function initDb(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
}

/**
 * Create a new better-sqlite3 Database at `dbPath` with pragmas configured.
 */
export function createDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  initDb(db);
  return db;
}

/**
 * Return the singleton database instance, creating it if necessary.
 */
export function getDatabase(): Database.Database {
  if (!singleton) {
    throw new Error(
      'Database not initialized. Call initDatabase() first.',
    );
  }
  return singleton;
}

/**
 * Convenience: create the database, run migrations, store as singleton.
 */
export async function initDatabase(dbPath?: string): Promise<Database.Database> {
  const { runMigrations } = await import('./migrate.js');
  const resolvedPath = dbPath ?? ':memory:';
  const db = createDatabase(resolvedPath);
  runMigrations(db);
  singleton = db;
  return db;
}
