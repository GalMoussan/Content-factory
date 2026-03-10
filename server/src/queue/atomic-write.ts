import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Write data to a JSON file atomically using write-tmp-rename pattern.
 * Ensures no partial files exist even if the process crashes mid-write.
 */
export function writeQueueFileAtomic(dir: string, filename: string, data: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, filename);
  const tmpPath = path.join(dir, `.${filename}.${randomUUID()}.tmp`);

  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, finalPath);
}
