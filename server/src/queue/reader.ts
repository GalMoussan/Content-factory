import fs from 'node:fs';
import path from 'node:path';
import type { ZodType } from 'zod';

/**
 * Read a JSON queue file and validate it against a Zod schema.
 * Throws ZodError if the data doesn't match the schema.
 * Throws if the file doesn't exist or contains malformed JSON.
 */
export function readQueueFile<T>(dir: string, filename: string, schema: ZodType<T>): T {
  const filePath = path.join(dir, filename);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return schema.parse(parsed);
}
