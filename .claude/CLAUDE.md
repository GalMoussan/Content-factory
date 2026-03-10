# ContentFactory

Multi-agent autonomous YouTube content creation system for the AI/Tech niche. Five pipeline agents run in sequence via a daily cron orchestrator.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ / TypeScript 5 |
| Backend | Express.js 4 |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Database | SQLite (better-sqlite3, WAL mode) |
| AI | Claude API (@anthropic-ai/sdk) |
| Video | Remotion 4 |
| TTS | Azure TTS |
| Upload | YouTube Data API v3 (OAuth2) |
| Queue | Filesystem JSON (atomic writes) |
| Validation | Zod 3 |
| Logging | Pino |
| Testing | Vitest + Playwright |

## Structure

```
server/src/
  agents/          # 5 pipeline agents + BaseAgent
  queue/           # JSON queue (atomic write-tmp-rename)
  db/              # SQLite + repositories
  routes/          # Express REST + SSE
  core/            # Retry, circuit breaker, lock, errors
  cron/            # Scheduler
  logging/         # Pino structured logging
  middleware/      # Express middleware
  services/        # Cost tracker, disk manager
  config/          # Env validation
client/src/
  components/      # Dashboard components
  pages/           # PipelineStatus, QAScores, PublishHistory
  hooks/           # useSSE
  lib/             # API client
shared/
  schemas/         # All Zod schemas (single source of truth)
  types/           # Agent, AgentContext, AgentResult interfaces
scripts/           # run-pipeline.ts, cron-scheduler.ts, authorize-youtube.ts
```

## Key Patterns

### Imports
```typescript
import path from 'node:path';           // 1. Node built-ins
import { z } from 'zod';                // 2. External
import { Schema } from '@shared/schemas'; // 3. Aliases
import { fn } from './local';           // 4. Relative
```

### Validation
Zod at every boundary — queue reads, queue writes, API inputs. Schemas in `shared/schemas/`.

### Error Handling
Three tiers: transient (retry), recoverable (restart agent), fatal (abort + dead-letter).

### Data Flow
Agents never share memory. Communication via `queue/data/run-{uuid}/` JSON files only. Atomic writes (write-tmp-rename).

### Immutability
Never mutate. Always return new objects.

## Commands

```bash
npm run dev           # Express + Vite dev
npm run build         # Build all
npm run typecheck     # TypeScript check
npm run test          # Vitest
npm run test:coverage # Coverage (80%+ target)
npm run test:e2e      # Playwright E2E
npm run lint          # ESLint
npm run pipeline      # Run pipeline once
npm run pipeline:cron # Start cron scheduler
```

## File Naming

- `kebab-case.ts` — source files
- `PascalCase.tsx` — React components
- `*.test.ts` — unit tests (co-located)
- `*.integration.test.ts` — integration tests
- `__fixtures__/` — test fixture data

## Commit Convention

`[Phase X] TXXX: Brief description`

Branch: `feat/TXXX-task-name`

## Docs Repo

Architecture, task specs, and planning at `../content-factory-docs/`.
