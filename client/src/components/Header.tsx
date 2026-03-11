interface HeaderProps {
  onTrigger?: () => void;
}

export function Header({ onTrigger }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-700 px-6 py-3">
      <h1 className="text-lg font-bold">Content Factory</h1>
      {onTrigger && (
        <button
          onClick={onTrigger}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-700"
        >
          Run Pipeline
        </button>
      )}
    </header>
  );
}
