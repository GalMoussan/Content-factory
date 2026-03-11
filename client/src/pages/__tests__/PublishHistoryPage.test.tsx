import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublishHistoryPage } from '../PublishHistoryPage';

// T023 — Publish History Page
// Tests will fail at import until PublishHistoryPage.tsx and its dependencies are created.

vi.mock('../../lib/api', () => ({
  getPublishHistory: vi.fn(),
}));

import { getPublishHistory } from '../../lib/api';

const MOCK_PUBLISH = {
  id: 1,
  runId: 'run-001',
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Top 5 AI Tools in 2026',
  status: 'live',
  qaScore: 82,
  publishedAt: '2026-03-10T08:00:00Z',
  metadata: {
    description: 'A deep dive into the best AI tools available today.',
    tags: ['AI', 'tech', '2026'],
    fileSizeMb: 250,
    durationSeconds: 480,
  },
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  const client = makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <PublishHistoryPage />
    </QueryClientProvider>,
  );
}

describe('T023 — Publish History Page', () => {
  beforeEach(() => {
    vi.mocked(getPublishHistory).mockResolvedValue({ data: [MOCK_PUBLISH], total: 1 });
  });

  // Acceptance: "Publish history table with pagination"
  it('should render the publish history table with rows', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Top 5 AI Tools in 2026')).toBeDefined());
  });

  // Acceptance: "YouTube links open in new tab"
  it('should render a YouTube link that opens in a new tab', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /youtube|watch|view/i });
    expect(link.getAttribute('href')).toContain('dQw4w9WgXcQ');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  // Acceptance: "Status badges color-coded"
  it('should display a live status badge', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/live/i)).toBeDefined());
  });

  it('should render an uploaded badge for uploaded status', async () => {
    vi.mocked(getPublishHistory).mockResolvedValue({
      data: [{ ...MOCK_PUBLISH, status: 'uploaded', id: 2 }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/uploaded/i)).toBeDefined());
  });

  // Acceptance: "QA score displayed for each publish"
  it('should display the QA score for each published video', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('82')).toBeDefined());
  });

  // Acceptance: "Expandable rows show full metadata"
  it('should expand a row and show description, tags, and file metadata', async () => {
    renderPage();
    const row = await screen.findByText('Top 5 AI Tools in 2026');
    await userEvent.click(row);

    await waitFor(() => {
      expect(
        screen.getByText(/A deep dive into the best AI tools available today./),
      ).toBeDefined();
      expect(screen.getByText(/AI/)).toBeDefined();
      expect(screen.getByText(/250/)).toBeDefined();
    });
  });

  // Acceptance: "Loading and empty states handled"
  it('should show empty state when there is no publish history', async () => {
    vi.mocked(getPublishHistory).mockResolvedValue({ data: [], total: 0 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no publish|no videos|empty/i)).toBeDefined(),
    );
  });

  // Acceptance: "Pagination is rendered and functional"
  it('should fetch page 2 when the next pagination button is clicked', async () => {
    vi.mocked(getPublishHistory).mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) => ({ ...MOCK_PUBLISH, id: i + 1 })),
      total: 25,
    });
    renderPage();

    const nextBtn = await screen.findByRole('button', { name: /next/i });
    await userEvent.click(nextBtn);

    expect(getPublishHistory).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });
});
