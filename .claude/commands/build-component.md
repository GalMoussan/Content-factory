# Build Component

Scaffold a React component following ContentFactory's frontend conventions.

## Input

Component name: $ARGUMENTS (e.g., PipelineProgress, QAScoreCard)

## Process

### 1. Understand Requirements
Infer the component's purpose from its name and the ContentFactory dashboard context.

### 2. Explore Existing Patterns
Read existing components in `client/src/components/` to understand:
- Functional components with named exports
- Tailwind CSS class patterns
- React Query hooks for server state
- SSE hook for real-time data
- Loading/error/empty state handling

### 3. Scaffold the Component

Create `client/src/components/{ComponentName}.tsx`:

```tsx
import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from './ui/Spinner';
import { ErrorBanner } from './ui/ErrorBanner';
import { EmptyState } from './ui/EmptyState';

interface ComponentNameProps {
  // typed props
}

export const ComponentName: FC<ComponentNameProps> = ({ prop }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['resource'],
    queryFn: () => fetchResource(),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner message={error.message} />;
  if (!data || data.length === 0) return <EmptyState message="No data found" />;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* content */}
    </div>
  );
};
```

### 4. Conventions
- Named exports only, props interface named `{ComponentName}Props`
- Tailwind CSS for all styling (no custom CSS)
- Handle all 3 states: loading, error, empty
- Status colors: green=success, red=error, yellow=flagged, blue=running, gray=idle
- Accessible: aria labels, keyboard nav, semantic HTML

## Output
- The component file
- A brief note on how to integrate it
