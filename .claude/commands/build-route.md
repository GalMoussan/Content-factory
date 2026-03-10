# Build Route

Scaffold an Express API route following ContentFactory's backend conventions.

## Input

Route path: $ARGUMENTS (e.g., /api/pipeline, /api/qa/scores)

## Process

### 1. Understand Requirements
Parse the route path to determine:
- Resource name
- Whether it's a collection or individual resource route
- Required HTTP methods (GET, POST, PUT, DELETE)

### 2. Explore Existing Patterns
Read existing routes in `server/src/routes/` to understand:
- Router setup and export patterns
- Middleware usage (rate limiter, error handler)
- Response envelope format: `{ success, data/error, meta }`
- Error codes from `shared/schemas/api-response.ts`

### 3. Scaffold the Route

Create `server/src/routes/{resource}.ts` with:

```typescript
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const router = Router();

// GET /api/{resource}
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    // Implementation using repository from server/src/db/repositories/
    res.json({ success: true, data: { items, total, page, limit }, meta: { timestamp: new Date().toISOString(), requestId: req.id } });
  } catch (err) {
    next(err);
  }
});

export { router as resourceRouter };
```

### 4. Register the Route
Add to `server/src/routes/index.ts`.

### 5. Conventions
- Response envelope: `{ success: true/false, data/error, meta: { timestamp, requestId } }`
- Paginated lists: `{ items, total, page, limit }`
- Error codes: VALIDATION_ERROR, NOT_FOUND, PIPELINE_BUSY, CIRCUIT_OPEN, INTERNAL_ERROR
- Zod validation on request bodies: `RequestSchema.parse(req.body)`
- All async handlers wrapped in try/catch with `next(err)`

## Output
- The route file
- Updated route registration
- Note on what repository/service is needed
