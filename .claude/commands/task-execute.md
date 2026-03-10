# Task Execute

Execute a task from the ContentFactory task board autonomously.

## Input

Task ID: $ARGUMENTS (e.g., T001, T014)

## Process

### 1. Load Task Spec
Read the task specification from `../content-factory-docs/tasks/`:
- Phase 1: `tasks/phase-1/T001-*.md` through `T006-*.md`
- Phase 2: `tasks/phase-2/T007-*.md` through `T011-*.md`
- Phase 3: `tasks/phase-3/T012-*.md` through `T017-*.md`
- Phase 4: `tasks/phase-4/T018-*.md` through `T023-*.md`
- Phase 5: `tasks/phase-5/T024-*.md` through `T029-*.md`

### 2. Check Dependencies
Read `../content-factory-docs/TASK_BOARD.md` and verify all "Depends On" tasks are marked DONE. If any are not, report which dependencies are missing and stop.

### 3. Understand Context
- Read the architecture docs: `../content-factory-docs/architecture/system-design.md`
- Read existing code files that will be modified
- Read shared schemas in `shared/schemas/` for data contracts
- Read related files to understand patterns in use

### 4. Plan Implementation
Before writing any code:
- List all files to create/modify
- Identify the build sequence (what to implement first)
- Note any decisions that need user input

### 5. Execute
Implement the task following ContentFactory conventions:
- Immutable data patterns (never mutate, return new objects)
- Named exports only
- Zod validation at all boundaries
- Atomic file writes for queue data
- Structured logging with pino child loggers
- All errors classified (transient/recoverable/fatal)
- Tests co-located with source (`*.test.ts`)

### 6. Verify
```bash
npm run typecheck
npm run test
npm run lint
```

### 7. Report
Output a summary:
- What was implemented
- Files created/modified
- Any decisions made
- What to test manually
- Suggested next steps

## Important
- Always read the full task spec before starting
- Follow the acceptance criteria exactly
- Don't modify files outside the task's scope
- Create a git branch: `feat/{task-id}-{short-name}` (e.g., `feat/T001-scaffold`)
- Commit format: `[Phase X] TXXX: Brief description`
