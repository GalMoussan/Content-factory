const BASE = '/api';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface PipelineStatus {
  status: 'idle' | 'running';
  currentAgent?: string;
  runId?: string;
}

export interface PipelineRun {
  id: string;
  status: string;
  startedAt: string;
  trigger: string;
  completedAt?: string;
  failedAgent?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface CircuitBreakerStatus {
  state: string;
  consecutiveFailures: number;
}

export interface QAScore {
  id: number;
  runId: string;
  overallScore: number;
  verdict: string;
  dimensions?: Record<string, { score: number; feedback: string; issues: string[] }>;
  createdAt: string;
}

export interface PublishEntry {
  id: number;
  runId: string;
  youtubeId: string;
  title: string;
  status: string;
  qaScore?: number;
  publishedAt: string;
  metadata?: {
    description: string;
    tags: string[];
    fileSizeMb: number;
    durationSeconds: number;
  };
}

export function getPipelineStatus(): Promise<PipelineStatus> {
  return fetchJSON('/pipeline/status');
}

export function triggerPipeline(): Promise<{ runId: string }> {
  return fetchJSON('/pipeline/trigger', { method: 'POST' });
}

export function getPipelineRuns(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<PipelineRun>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchJSON(`/pipeline/runs${qs ? `?${qs}` : ''}`);
}

export function getCircuitBreakerStatus(): Promise<CircuitBreakerStatus> {
  return fetchJSON('/circuit-breaker/status');
}

export function resetCircuitBreaker(): Promise<{ success: boolean }> {
  return fetchJSON('/circuit-breaker/reset', { method: 'POST' });
}

export function getQAScores(params?: { page?: number; limit?: number; verdict?: string }): Promise<PaginatedResponse<QAScore>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.verdict) query.set('verdict', params.verdict);
  const qs = query.toString();
  return fetchJSON(`/qa/scores${qs ? `?${qs}` : ''}`);
}

export function getPublishHistory(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<PublishEntry>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchJSON(`/publish/history${qs ? `?${qs}` : ''}`);
}
