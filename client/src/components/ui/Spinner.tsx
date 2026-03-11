export function Spinner() {
  return (
    <div role="status" className="flex items-center justify-center p-4">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-500 border-t-blue-500" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
