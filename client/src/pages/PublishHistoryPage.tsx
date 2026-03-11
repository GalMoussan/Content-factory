import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublishHistory } from '../lib/api';
import type { PublishEntry } from '../lib/api';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

function PublishRow({ entry, expanded, onToggle }: { entry: PublishEntry; expanded: boolean; onToggle: () => void }) {
  if (expanded && entry.metadata) {
    return (
      <tr
        className="border-b border-gray-800 bg-gray-800/30 cursor-pointer"
        onClick={onToggle}
      >
        <td colSpan={5} className="px-6 py-3 text-sm">
          {entry.metadata.description} | Tags: {entry.metadata.tags.join(', ')} | Size: {entry.metadata.fileSizeMb} MB | Duration: {entry.metadata.durationSeconds}s
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
      onClick={onToggle}
    >
      <td className="px-3 py-2">{entry.title}</td>
      <td className="px-3 py-2">
        <Badge status={entry.status} />
      </td>
      <td className="px-3 py-2">{entry.qaScore}</td>
      <td className="px-3 py-2">
        <a
          href={`https://www.youtube.com/watch?v=${entry.youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="View on YouTube"
        >
          YouTube
        </a>
      </td>
      <td className="px-3 py-2 text-sm text-gray-400">
        {entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : ''}
      </td>
    </tr>
  );
}

export function PublishHistoryPage() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ['publish-history', page],
    queryFn: () => getPublishHistory({ page, limit: 10 }),
  });

  if (query.isLoading) return <Spinner />;

  const entries = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / 10);

  if (entries.length === 0) {
    return <EmptyState label="No publish history yet" />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Publish History</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="px-3 py-2 font-medium text-gray-400">Title</th>
            <th className="px-3 py-2 font-medium text-gray-400">Status</th>
            <th className="px-3 py-2 font-medium text-gray-400">QA Score</th>
            <th className="px-3 py-2 font-medium text-gray-400">Link</th>
            <th className="px-3 py-2 font-medium text-gray-400">Published</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <PublishRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="rounded px-3 py-1 text-sm disabled:opacity-50"
            aria-label="Next"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
