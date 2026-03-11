import Anthropic from '@anthropic-ai/sdk';
import type { ContentBundle, QADimension } from '@shared/schemas';

const REQUIRED_DIMENSIONS = [
  'script-quality',
  'factual-accuracy',
  'audio-quality',
  'visual-quality',
  'seo-optimization',
  'originality',
] as const;

const SCORING_PROMPT = `You are a content quality analyst. Score the following content bundle across these 6 dimensions:
${REQUIRED_DIMENSIONS.map((d) => `- ${d}`).join('\n')}

For each dimension, return a JSON array of objects with:
- "dimension": the dimension name
- "score": a number 0-100
- "feedback": a brief explanation
- "issues": an array of issue strings (empty if none)

Return ONLY the JSON array, no extra text.`;

/**
 * Score a ContentBundle across 6 quality dimensions using Claude Haiku.
 */
export async function scoreContentBundle(
  bundle: ContentBundle,
  apiKey: string,
): Promise<QADimension[]> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${SCORING_PROMPT}\n\nContent Bundle:\n${JSON.stringify(bundle, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content[0];
  const rawText = 'text' in textBlock
    ? (textBlock as unknown as { text: string }).text
    : 'content' in textBlock
      ? (textBlock as unknown as { content: string }).content
      : '';
  // Strip markdown code fences if present
  const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const dimensions: QADimension[] = JSON.parse(cleaned);

  return dimensions;
}
