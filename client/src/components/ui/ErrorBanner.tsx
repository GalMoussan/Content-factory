interface ErrorBannerProps {
  message: string | undefined;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded border border-red-700 bg-red-900/50 p-3 text-red-300">
      {message}
    </div>
  );
}
