interface ScoreBarProps {
  score: number;
}

export function ScoreBar({ score }: ScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="h-2 w-full rounded bg-gray-700">
      <div
        data-score-bar
        className="h-full rounded bg-blue-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
