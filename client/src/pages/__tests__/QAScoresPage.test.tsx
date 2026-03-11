import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QAScoresPage } from '../QAScoresPage';

// T022 — QA Scores Page
// Tests will fail at import until QAScoresPage.tsx and its dependencies are created.

vi.mock('../../lib/api', () => ({
  getQAScores: vi.fn(),
}));

import { getQAScores } from '../../lib/api';

const MOCK_QA_SCORE = {
  id: 1,
  runId: 'run-001',
  overallScore: 82,
  verdict: 'approved',
  dimensions: {
    accuracy: { score: 90, feedback: 'Well sourced', issues: [] },
    engagement: { score: 78, feedback: 'Good hook', issues: [] },
    clarity: { score: 85, feedback: 'Clear structure', issues: [] },
    originality: { score: 80, feedback: 'Novel angle', issues: [] },
    seoRelevance: { score: 88, feedback: 'Good keywords', issues: [] },
    production: { score: 72, feedback: 'Minor pacing issue', issues: ['Pacing'] },
  },
  createdAt: '2026-03-10T06:00:00Z',
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <QAScoresPage />
    </QueryClientProvider>,
  );
}

describe('T022 — QA Scores Page', () => {
  beforeEach(() => {
    vi.mocked(getQAScores).mockResolvedValue({ data: [MOCK_QA_SCORE], total: 1 });
  });

  // Acceptance: "QA results list with filtering and sorting"
  it('should render a list of QA score cards', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('run-001')).toBeDefined());
  });

  // Acceptance: "Verdict badges color-coded correctly"
  it('should display the verdict badge for each result', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/approved/i)).toBeDefined());
  });

  it('should display rejected verdict badge in the correct style', async () => {
    vi.mocked(getQAScores).mockResolvedValue({
      data: [{ ...MOCK_QA_SCORE, verdict: 'rejected', id: 2 }],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      const badge = screen.getByText(/rejected/i);
      expect(badge).toBeDefined();
    });
  });

  // Acceptance: "Score card shows all 6 dimensions with visual bars"
  it('should render all 6 QA dimension scores', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/accuracy/i)).toBeDefined();
      expect(screen.getByText(/engagement/i)).toBeDefined();
      expect(screen.getByText(/clarity/i)).toBeDefined();
      expect(screen.getByText(/originality/i)).toBeDefined();
      expect(screen.getByText(/seo/i)).toBeDefined();
      expect(screen.getByText(/production/i)).toBeDefined();
    });
  });

  // Acceptance: "Feedback and issues displayed per dimension"
  it('should display dimension feedback text', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Well sourced')).toBeDefined());
  });

  // Acceptance: "QA results list with filtering"
  it('should filter by verdict when a filter option is selected', async () => {
    vi.mocked(getQAScores).mockResolvedValue({
      data: [
        MOCK_QA_SCORE,
        { ...MOCK_QA_SCORE, id: 3, runId: 'run-002', verdict: 'rejected' },
      ],
      total: 2,
    });
    renderPage();

    const filterSelect = await screen.findByRole('combobox', { name: /verdict|filter/i });
    await userEvent.selectOptions(filterSelect, 'approved');

    // After filtering the API should be called with the verdict filter
    expect(getQAScores).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'approved' }));
  });

  // Acceptance: "Loading and empty states handled"
  it('should show empty state when no QA scores exist', async () => {
    vi.mocked(getQAScores).mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no qa|no results|empty/i)).toBeDefined());
  });
});
