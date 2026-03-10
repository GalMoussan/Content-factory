import type { AgentContext, AgentResult } from '@shared/types/agent';
import type { BaseAgent } from './base-agent.js';

/**
 * Run an agent with a timeout. If the agent doesn't complete within
 * the given milliseconds, returns a failed AgentResult.
 */
export async function runAgentWithTimeout<I, O>(
  agent: BaseAgent<I, O>,
  ctx: AgentContext,
  timeoutMs: number,
): Promise<AgentResult<O>> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          success: false,
          error: {
            errorType: 'transient',
            message: `Agent ${agent.name} timeout after ${timeoutMs}ms`,
          },
        });
      }
    }, timeoutMs);

    agent.execute(ctx).then(
      (result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(result);
        }
      },
      (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            success: false,
            error: {
              errorType: 'recoverable',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
      },
    );
  });
}
