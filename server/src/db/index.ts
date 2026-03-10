// Connection & migration
export { initDb, createDatabase, getDatabase, initDatabase } from './connection.js';
export { runMigrations } from './migrate.js';

// Repositories
export {
  createPipelineRun,
  getPipelineRun,
  updatePipelineRunStatus,
  listPipelineRuns,
} from './repositories/pipeline-runs.js';
export type { PipelineRun, CreatePipelineRunInput, UpdatePipelineRunInput } from './repositories/pipeline-runs.js';

export {
  createAgentExecution,
  getAgentExecutionsForRun,
  updateAgentExecution,
} from './repositories/agent-executions.js';
export type { AgentExecution, CreateAgentExecutionInput, UpdateAgentExecutionInput } from './repositories/agent-executions.js';

export {
  createQAScore,
  getQAScoreForRun,
  getQAScoresByRun,
  getLatestQAScores,
} from './repositories/qa-scores.js';
export type { QAScore, CreateQAScoreInput } from './repositories/qa-scores.js';

export {
  createPublishLog,
  getPublishLogForRun,
  updatePublishLogStatus,
  getPublishHistory,
  getPublishByRun,
} from './repositories/publish-log.js';
export type { PublishLog, CreatePublishLogInput } from './repositories/publish-log.js';

export {
  getCircuitBreakerState,
  updateCircuitBreakerState,
  initCircuitBreaker,
} from './repositories/circuit-breaker.js';
export type { CircuitBreakerState, UpdateCircuitBreakerInput } from './repositories/circuit-breaker.js';
