import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPipelineStatus,
  triggerPipeline,
  getPipelineRuns,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from '../lib/api';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';

export function PipelineStatusPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const statusQuery = useQuery({
    queryKey: ['pipeline-status'],
    queryFn: getPipelineStatus,
  });

  const runsQuery = useQuery({
    queryKey: ['pipeline-runs', page],
    queryFn: () => getPipelineRuns({ page, limit: 10 }),
  });

  const cbQuery = useQuery({
    queryKey: ['circuit-breaker'],
    queryFn: getCircuitBreakerStatus,
  });

  const triggerMutation = useMutation({
    mutationFn: triggerPipeline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-status'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetCircuitBreaker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circuit-breaker'] });
    },
  });

  if (statusQuery.isLoading) {
    return <Spinner />;
  }

  const status = statusQuery.data;
  const isRunning = status?.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">Pipeline Status</h2>
        <Badge status={status?.status ?? 'idle'} />
        {isRunning && status?.currentAgent && (
          <span className="text-sm text-gray-400">
            Current agent: <strong>{status.currentAgent}</strong>
          </span>
        )}
        <button
          onClick={() => triggerMutation.mutate()}
          disabled={isRunning}
          className="ml-auto rounded bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          aria-label="Run Pipeline"
        >
          Run Pipeline
        </button>
      </div>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Run History</h3>
        <DataTable
          columns={[
            { key: 'id', label: 'Run ID' },
            { key: 'status', label: 'Status' },
            { key: 'startedAt', label: 'Started' },
            { key: 'trigger', label: 'Trigger' },
          ]}
          rows={(runsQuery.data?.data ?? []).map((r) => ({
            id: r.id,
            status: r.status,
            startedAt: r.startedAt,
            trigger: r.trigger,
          })) as unknown as Record<string, unknown>[]}
          totalRows={runsQuery.data?.total ?? 0}
          pageSize={10}
          currentPage={page}
          onPageChange={setPage}
        />
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Circuit Breaker</h3>
        {cbQuery.data && (
          <div className="flex items-center gap-4">
            <Badge status={cbQuery.data.state.toLowerCase()} />
            <span className="text-sm text-gray-400">
              {cbQuery.data.consecutiveFailures} consecutive failures
            </span>
            {cbQuery.data.state !== 'CLOSED' && (
              <button
                onClick={() => resetMutation.mutate()}
                className="rounded border border-gray-600 px-3 py-1 text-sm hover:bg-gray-800"
                aria-label="Reset"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
