import path from 'node:path';
import express from 'express';
import { initDatabase } from './db/connection.js';
import { registerRoutes } from './routes/index.js';
import { logger } from './logging/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const DB_PATH = process.env['DB_PATH'] ?? path.join(process.cwd(), 'data', 'content-factory.db');

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Ensure data directory exists
  const { mkdirSync } = await import('node:fs');
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Initialize database
  const db = await initDatabase(DB_PATH);
  logger.info({ dbPath: DB_PATH }, 'Database initialized');

  // Register API routes
  registerRoutes(app, { db });

  // Serve client in production
  if (process.env['NODE_ENV'] === 'production') {
    const clientDist = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'ContentFactory server listening');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});
