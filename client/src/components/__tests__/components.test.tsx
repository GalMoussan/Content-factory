import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Spinner } from '../ui/Spinner';
import { ErrorBanner } from '../ui/ErrorBanner';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { ScoreBar } from '../ui/ScoreBar';
import { DashboardLayout } from '../DashboardLayout';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';

// T020 — React Dashboard Layout and Components
// Tests will fail at import until component files are created.

describe('T020 — Dashboard Layout and Shared UI Components', () => {
  // Acceptance: "All shared UI components render correctly"
  describe('Spinner', () => {
    it('should render a loading spinner element', () => {
      render(<Spinner />);
      expect(screen.getByRole('status')).toBeDefined();
    });
  });

  describe('ErrorBanner', () => {
    it('should display the provided error message', () => {
      render(<ErrorBanner message="Something went wrong" />);
      expect(screen.getByText('Something went wrong')).toBeDefined();
    });

    it('should not render when message is empty or undefined', () => {
      const { container } = render(<ErrorBanner message="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('EmptyState', () => {
    it('should render with a label when no items exist', () => {
      render(<EmptyState label="No runs yet" />);
      expect(screen.getByText('No runs yet')).toBeDefined();
    });
  });

  // Acceptance: "Badge component renders with correct colour per status"
  describe('Badge', () => {
    it('should render a running badge with the correct variant class', () => {
      const { container } = render(<Badge status="running" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toMatch(/running/i);
    });

    it('should render completed badge', () => {
      render(<Badge status="completed" />);
      expect(screen.getByText(/completed/i)).toBeDefined();
    });

    it('should render failed badge', () => {
      render(<Badge status="failed" />);
      expect(screen.getByText(/failed/i)).toBeDefined();
    });
  });

  // Acceptance: "DataTable renders data rows and supports pagination"
  describe('DataTable', () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'status', label: 'Status' },
    ];
    const rows = [
      { id: 'run-1', status: 'completed' },
      { id: 'run-2', status: 'failed' },
    ];

    it('should render column headers and data rows', () => {
      render(<DataTable columns={columns} rows={rows} />);
      expect(screen.getByText('ID')).toBeDefined();
      expect(screen.getByText('run-1')).toBeDefined();
      expect(screen.getByText('run-2')).toBeDefined();
    });

    it('should call onPageChange when pagination is used', async () => {
      const onPageChange = vi.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          totalRows={20}
          pageSize={2}
          currentPage={1}
          onPageChange={onPageChange}
        />,
      );
      const nextBtn = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextBtn);
      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  // Acceptance: "ScoreBar renders visual representation of 0-100 score"
  describe('ScoreBar', () => {
    it('should render a bar with width proportional to the score', () => {
      const { container } = render(<ScoreBar score={75} />);
      const bar = container.querySelector('[data-score-bar]') as HTMLElement;
      expect(bar).not.toBeNull();
      // The bar's inline style or class should reflect 75%
      expect(bar.style.width || bar.getAttribute('class')).toMatch(/75/);
    });

    it('should clamp score to 0-100 range', () => {
      expect(() => render(<ScoreBar score={150} />)).not.toThrow();
    });
  });

  // Acceptance: "Dashboard layout renders with sidebar navigation"
  describe('DashboardLayout', () => {
    it('should render children inside the layout', () => {
      render(
        <DashboardLayout>
          <div data-testid="child">page content</div>
        </DashboardLayout>,
      );
      expect(screen.getByTestId('child')).toBeDefined();
    });
  });

  describe('Sidebar', () => {
    it('should render navigation links for all main pages', () => {
      render(<Sidebar />);
      expect(screen.getByText(/pipeline/i)).toBeDefined();
      expect(screen.getByText(/qa/i)).toBeDefined();
      expect(screen.getByText(/publish/i)).toBeDefined();
    });
  });

  describe('Header', () => {
    it('should render the app title', () => {
      render(<Header />);
      expect(screen.getByText(/content factory/i)).toBeDefined();
    });

    it('should show a pipeline trigger button', () => {
      render(<Header onTrigger={vi.fn()} />);
      expect(screen.getByRole('button', { name: /run|trigger/i })).toBeDefined();
    });
  });
});
