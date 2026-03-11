import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PipelineStatusPage } from '../PipelineStatusPage';

// T021 — Pipeline Status Page
// Tests will fail at import until PipelineStatusPage.tsx and its dependencies are created.

// Stub the API module so network calls never fire in tests
vi.mock('../../lib/api', () => ({
  getPipelineStatus: vi.fn(),
  triggerPipeline: vi.fn(),
  getPipelineRuns: vi.fn(),
  getCircuitBreakerStatus: vi.fn(),
  resetCircuitBreaker: vi.fn(),
}));

vi.mock('../../hooks/use-sse', () => ({
  useSSE: vi.fn().mockReturnValue({ lastEvent: null, connected: true }),
}));

import {
  getPipelineStatus,
  triggerPipeline,
  getPipelineRuns,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from '../../lib/api';

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <PipelineStatusPage />
    </QueryClientProvider>,
  );
}

describe('T021 — Pipeline Status Page', () => {
  beforeEach(() => {
    vi.mocked(getPipelineStatus).mockResolvedValue({ status: 'idle' });
    vi.mocked(getPipelineRuns).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(getCircuitBreakerStatus).mockResolvedValue({
      state: 'CLOSED',
      consecutiveFailures: 0,
    });
  });

  // Acceptance: "Pipeline status shows idle/running state"
  it('should display idle status when pipeline is not running', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/idle/i)).toBeDefined());
  });

  it('should display running status and agent progress when pipeline is active', async () => {
    vi.mocked(getPipelineStatus).mockResolvedValue({
      status: 'running',
      currentAgent: 'ContentProducer',
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/running/i)).toBeDefined();
      expect(screen.getByText(/ContentProducer/i)).toBeDefined();
    });
  });

  // Acceptance: "Pipeline trigger button respects current state"
  it('should disable the trigger button when pipeline is running', async () => {
    vi.mocked(getPipelineStatus).mockResolvedValue({ status: 'running' });
    renderPage();

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /run|trigger/i });
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('should call triggerPipeline API when the trigger button is clicked while idle', async () => {
    vi.mocked(triggerPipeline).mockResolvedValue({ runId: 'r-new' });
    renderPage();

    const btn = await screen.findByRole('button', { name: /run|trigger/i });
    await userEvent.click(btn);

    expect(triggerPipeline).toHaveBeenCalledOnce();
  });

  // Acceptance: "Run history table with pagination and expandable rows"
  it('should render the run history table', async () => {
    vi.mocked(getPipelineRuns).mockResolvedValue({
      data: [
        { id: 'r001', status: 'completed', startedAt: '2026-03-10T06:00:00Z', trigger: 'cron' },
      ],
      total: 1,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('r001')).toBeDefined());
  });

  // Acceptance: "Circuit breaker status visible with reset functionality"
  it('should display circuit breaker state', async () => {
    vi.mocked(getCircuitBreakerStatus).mockResolvedValue({
      state: 'OPEN',
      consecutiveFailures: 3,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText(/open/i)).toBeDefined());
  });

  it('should call resetCircuitBreaker when reset button is clicked', async () => {
    vi.mocked(getCircuitBreakerStatus).mockResolvedValue({
      state: 'OPEN',
      consecutiveFailures: 3,
    });
    vi.mocked(resetCircuitBreaker).mockResolvedValue({ success: true });
    renderPage();

    const resetBtn = await screen.findByRole('button', { name: /reset/i });
    await userEvent.click(resetBtn);

    expect(resetCircuitBreaker).toHaveBeenCalledOnce();
  });

  // Acceptance: "All components handle loading and error states"
  it('should display a loading spinner while fetching pipeline status', () => {
    vi.mocked(getPipelineStatus).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    renderPage();
    expect(screen.getByRole('status')).toBeDefined();
  });
});
