interface BadgeProps {
  status: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  running: 'bg-blue-900 text-blue-300 running',
  completed: 'bg-green-900 text-green-300 completed',
  failed: 'bg-red-900 text-red-300 failed',
  approved: 'bg-green-900 text-green-300 approved',
  rejected: 'bg-red-900 text-red-300 rejected',
  live: 'bg-green-900 text-green-300 live',
  uploaded: 'bg-yellow-900 text-yellow-300 uploaded',
  idle: 'bg-gray-700 text-gray-300 idle',
};

export function Badge({ status }: BadgeProps) {
  const classes = VARIANT_CLASSES[status] ?? 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}
