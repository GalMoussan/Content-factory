import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="border-b border-gray-700 p-4">
          <h1 className="text-xl font-bold">ContentFactory Dashboard</h1>
        </header>
        <main className="p-4">
          <p className="text-gray-400">Pipeline dashboard coming soon.</p>
        </main>
      </div>
    </QueryClientProvider>
  );
}
