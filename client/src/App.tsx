import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { PipelineStatusPage } from './pages/PipelineStatusPage';
import { QAScoresPage } from './pages/QAScoresPage';
import { PublishHistoryPage } from './pages/PublishHistoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<PipelineStatusPage />} />
            <Route path="/qa" element={<QAScoresPage />} />
            <Route path="/publish" element={<PublishHistoryPage />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
