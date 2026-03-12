import type { QADimension } from '@shared/schemas';

export interface VerdictConfig {
  readonly approveThreshold: number;
  readonly rejectThreshold: number;
}

export interface VerdictResult {
  readonly overallScore: number;
  readonly verdict: 'approved' | 'rejected' | 'flagged';
  readonly verdictReason: string;
}

const DEFAULT_CONFIG: VerdictConfig = {
  approveThreshold: 60,
  rejectThreshold: 30,
};

/**
 * Compute the overall score as an equal-weighted average and apply threshold logic.
 * >= approveThreshold  → approved
 * <= rejectThreshold   → rejected
 * else                 → flagged
 */
export function renderVerdict(
  dimensions: readonly QADimension[],
  config: VerdictConfig = DEFAULT_CONFIG,
): VerdictResult {
  const { approveThreshold, rejectThreshold } = config;

  const overallScore =
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;

  const roundedScore = Math.round(overallScore * 100) / 100;

  let verdict: 'approved' | 'rejected' | 'flagged';
  let verdictReason: string;

  if (roundedScore >= approveThreshold) {
    verdict = 'approved';
    verdictReason = `Overall score ${roundedScore} meets the approval threshold of ${approveThreshold}.`;
  } else if (roundedScore <= rejectThreshold) {
    verdict = 'rejected';
    verdictReason = `Overall score ${roundedScore} falls at or below the rejection threshold of ${rejectThreshold}.`;
  } else {
    verdict = 'flagged';
    verdictReason = `Overall score ${roundedScore} is between thresholds (${rejectThreshold}, ${approveThreshold}). Manual review recommended.`;
  }

  return { overallScore: roundedScore, verdict, verdictReason };
}
