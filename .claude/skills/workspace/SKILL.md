# ContentFactory Workspace

This skill provides context about ContentFactory's project structure, build system, and code organization.

## Project Layout

```
ContentFactory/
├── content-factory/              # Code repository
│   ├── .claude/                  # Agent config
│   │   ├── agents/               # Specialized agents
│   │   ├── commands/             # Workflow commands
│   │   └── skills/              # Always-on context
│   ├── server/src/
│   │   ├── agents/               # 5 pipeline agents + base class
│   │   ├── queue/                # JSON queue (atomic writes)
│   │   ├── db/                   # SQLite layer + repositories
│   │   ├── routes/               # Express REST API + SSE
│   │   ├── services/             # Business logic
│   │   ├── core/                 # Retry, circuit breaker, lock, errors
│   │   ├── cron/                 # Scheduler
│   │   ├── logging/              # Pino structured logging
│   │   ├── middleware/           # Express middleware
│   │   └── config/              # Env validation
│   ├── client/src/               # React dashboard
│   │   ├── components/           # UI components
│   │   ├── pages/                # Dashboard pages
│   │   ├── hooks/                # Custom hooks (SSE)
│   │   └── lib/                  # API client
│   ├── shared/                   # Shared types + Zod schemas
│   │   ├── schemas/              # All Zod schemas
│   │   └── types/                # TypeScript interfaces
│   ├── scripts/                  # CLI tools + cron
│   └── tests/                    # E2E tests (Playwright)
└── content-factory-docs/          # Documentation repository
    ├── architecture/              # System design, data flow
    ├── developer/                 # Setup, standards, API ref
    ├── product/                   # Features, roadmap
    ├── resources/                 # Tech stack, changelog
    ├── testing/                   # Test plan
    └── tasks/                     # Task specs (phase-1/ through phase-5/)
```

## Build Order

1. `shared/` — Schemas and types (no dependencies)
2. `server/src/db/` — Database layer
3. `server/src/queue/` — Queue system (depends on schemas)
4. `server/src/core/` — Retry, circuit breaker, lock
5. `server/src/agents/` — Pipeline agents (depends on queue, DB, schemas)
6. `server/src/pipeline/` — Orchestrator (depends on agents)
7. `server/src/routes/` — API routes (depends on DB, pipeline)
8. `server/src/cron/` — Scheduler (depends on pipeline, routes)
9. `client/src/` — React dashboard (depends on API routes)

## Key Commands

```bash
npm run dev           # Express + Vite dev servers
npm run build         # Build server + client
npm run typecheck     # TypeScript checking
npm run test          # Vitest (unit + integration)
npm run test:coverage # With coverage
npm run test:e2e      # Playwright E2E
npm run lint          # ESLint
npm run pipeline      # Run pipeline once (manual)
npm run pipeline:cron # Start cron scheduler
```

## Adding New Code

- **New agent**: Create directory in `server/src/agents/`, extend `BaseAgent`, add schemas to `shared/schemas/`
- **New route**: Create file in `server/src/routes/`, register in `routes/index.ts`
- **New component**: Create file in `client/src/components/`, use Tailwind + React Query
- **New schema**: Create file in `shared/schemas/`, add to barrel export in `shared/index.ts`
- **New test**: Co-locate with source as `*.test.ts`, or `__tests__/` for integration tests
