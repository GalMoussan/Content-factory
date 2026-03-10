# Design Schema

Design a Zod schema following ContentFactory's validation conventions.

## Input

Schema name: $ARGUMENTS (e.g., ScoredTopic, QAResult)

## Process

### 1. Understand Requirements
Determine from the name and context:
- What data this schema validates
- Where it will be used (queue contract, API input, DB record)
- Related schemas in `shared/schemas/`

### 2. Explore Existing Patterns
Read schemas in `shared/schemas/` to match:
- Schema definition style (const + export)
- Type inference via `z.infer<typeof Schema>`
- Naming: `{Name}Schema` for Zod object, `{Name}` for inferred type
- Validation rules: `.min()`, `.max()`, `.uuid()`, `.datetime()`, `.enum()`

### 3. Design the Schema

```typescript
import { z } from 'zod';

export const MySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().datetime(),
});

export type My = z.infer<typeof MySchema>;
```

### 4. Export
Add to barrel exports in `shared/index.ts`.

### 5. Conventions
- All inter-agent queue data MUST have a schema
- Schemas include `runId`, `agentName`, `generatedAt` for queue files
- Use discriminated unions for event types (SSE events)
- Helper schemas for pagination: `PaginatedSchema<T>`
- Always export both the Zod schema object and the inferred TypeScript type

## Output
- The schema definition
- Inferred TypeScript type
- Added to barrel exports
