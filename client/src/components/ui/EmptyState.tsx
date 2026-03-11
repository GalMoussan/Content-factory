interface EmptyStateProps {
  label: string;
}

export function EmptyState({ label }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center p-8 text-gray-400">
      <p>{label}</p>
    </div>
  );
}
