# ContentFactory Conventions

This skill provides context about ContentFactory's coding patterns and conventions.

## Validation Approach

Zod schemas at every boundary:
- Queue reads: `readQueueFile<T>(runDir, filename, schema)` validates on read
- Queue writes: `writeQueueFile<T>(runDir, filename, data, schema)` validates before write
- API inputs: `RequestSchema.parse(req.body)` in route handlers
- API responses: Consistent `{ success, data/error, meta }` envelope
- All schemas live in `shared/schemas/` and export both Zod objects and inferred types

## Import Conventions

```typescript
// 1. Node built-ins
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// 2. External packages
import express from 'express';
import { z } from 'zod';
import Database from 'better-sqlite3';

// 3. Internal aliases
import { ScoredTopicListSchema } from '@shared/schemas';
import { db } from '@server/db';

// 4. Relative imports
import { scoreTopics } from './scoring';
```

## Error Handling

Three-tier error classification:
- **Transient** (retry with backoff): network timeout, API rate limit, 503
- **Recoverable** (restart agent): Playwright crash, TTS failure
- **Fatal** (abort, dead-letter): validation failure, OAuth expired, disk full

Agent errors are recorded, not thrown:
```typescript
return { status: 'error', error: { code: 'EXTERNAL_API_FAILURE', message, retryable: true } };
```

## File Naming

- `kebab-case.ts` for source files
- `PascalCase.tsx` for React components
- `*.test.ts` / `*.test.tsx` for tests
- `*.integration.test.ts` for integration tests
- `*.schema.ts` only if a dedicated schema file (prefer `shared/schemas/` centralization)

## Key Patterns

- **Immutable data**: Always return new objects, never mutate
- **Atomic writes**: Queue files use write-tmp-rename pattern
- **Agent lifecycle**: BaseAgent template method (read → validate → process → validate → write → record → emit)
- **Run isolation**: Each pipeline run in `queue/data/run-{uuid}/`
- **Circuit breaker**: SQLite-persisted state, 3-failure threshold, 60-min cooldown
- **Structured logging**: Pino with child loggers carrying `{ runId, agentName }`
