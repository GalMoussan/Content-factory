import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQAScores } from '../lib/api';
import type { QAScore } from '../lib/api';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { ScoreBar } from '../components/ui/ScoreBar';
import { EmptyState } from '../components/ui/EmptyState';

const DIMENSION_LABELS: Record<string, string> = {
  accuracy: 'Accuracy',
  engagement: 'Engagement',
  clarity: 'Clarity',
  originality: 'Originality',
  seoRelevance: 'SEO Relevance',
  production: 'Production',
};

function ScoreCard({ score }: { score: QAScore }) {
  return (
    <div className="rounded border border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{score.runId}</span>
        <Badge status={score.verdict} />
      </div>
      <div className="text-2xl font-bold">{score.overallScore}</div>
      {score.dimensions && (
        <div className="space-y-2">
          {Object.entries(score.dimensions).map(([key, dim]) => (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span>{DIMENSION_LABELS[key] ?? key}</span>
                <span>{dim.score}</span>
              </div>
              <ScoreBar score={dim.score} />
              <p className="text-xs text-gray-400">{dim.feedback}</p>
              {dim.issues.length > 0 && (
                <ul className="text-xs text-red-400">
                  {dim.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function QAScoresPage() {
  const [verdict, setVerdict] = useState<string>('');
  const [page] = useState(1);

  const query = useQuery({
    queryKey: ['qa-scores', page, verdict],
    queryFn: () => getQAScores({ page, ...(verdict ? { verdict } : {}) }),
  });

  if (query.isLoading) return <Spinner />;

  const scores = query.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold">QA Scores</h2>
        <label className="text-sm text-gray-400">
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            className="ml-2 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
            aria-label="Filter by verdict"
            role="combobox"
          >
            <option value="">All</option>
            <option value="approved">&#x2705; Pass</option>
            <option value="rejected">&#x274C; Fail</option>
          </select>
        </label>
      </div>

      {scores.length === 0 ? (
        <EmptyState label="No QA results yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scores.map((score) => (
            <ScoreCard key={score.id} score={score} />
          ))}
        </div>
      )}
    </div>
  );
}
