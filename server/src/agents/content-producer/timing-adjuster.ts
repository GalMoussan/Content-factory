import type { ScriptSection } from '@shared/schemas';

/**
 * Redistribute section durations proportionally by word count
 * based on actual total audio duration.
 *
 * This replaces Claude's arbitrary durationSeconds estimates with
 * values derived from the real TTS audio length.
 */
export function adjustSectionTimings(
  sections: readonly ScriptSection[],
  actualTotalDurationSeconds: number,
): readonly ScriptSection[] {
  const wordCounts = sections.map(
    (s) => s.content.split(/\s+/).filter(Boolean).length,
  );
  const totalWords = wordCounts.reduce((sum, c) => sum + c, 0);

  if (totalWords === 0) {
    return sections;
  }

  return sections.map((section, i) => ({
    ...section,
    durationSeconds: (wordCounts[i] / totalWords) * actualTotalDurationSeconds,
  }));
}
