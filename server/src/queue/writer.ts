import type { ZodType } from 'zod';
import { writeQueueFileAtomic } from './atomic-write.js';

/**
 * Validate data against a Zod schema, then write it atomically.
 * If validation fails, throws ZodError and does NOT write a file.
 */
export function writeQueueFile<T>(dir: string, filename: string, data: T, schema: ZodType<T>): void {
  schema.parse(data);
  writeQueueFileAtomic(dir, filename, data);
}
