import Anthropic from '@anthropic-ai/sdk';
import type { ResearchDossier, ScriptSection } from '@shared/schemas';

export interface ScriptResult {
  readonly sections: readonly ScriptSection[];
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly claudeTokensUsed: number;
}

/**
 * Generate a YouTube video script from a research dossier using Claude API.
 */
export async function generateScript(
  dossier: ResearchDossier,
  claudeApiKey: string,
): Promise<ScriptResult> {
  const client = new Anthropic({ apiKey: claudeApiKey });

  const systemPrompt = `You are a YouTube scriptwriter for a developer tips & tricks channel hosted by an enthusiastic Indian developer.
The tone is friendly, practical, and energetic — like a senior dev sharing shortcuts with a colleague over chai.
Use simple, clear English. Avoid jargon walls. Favor concrete examples and "here's what you do" phrasing.

Given research data, produce a structured video script as JSON with:
- sections: array of { type, content, durationSeconds } where type is one of: hook, intro, body, examples, cta, outro
- title: YouTube-optimized title (max 100 chars) — use power words like "hack", "trick", "shortcut", "instantly"
- description: YouTube description
- tags: array of relevant tags

The hook should open with a relatable developer pain point. The body and examples should focus on actionable steps the viewer can use immediately. Keep it conversational, not lecture-style.

Respond ONLY with valid JSON matching this structure.`;

  const userPrompt = `Research Dossier:
Topic: ${dossier.topicTitle}
Suggested Angle: ${dossier.suggestedAngle}
Target Duration: ${dossier.estimatedScriptMinutes} minutes

Key Points:
${dossier.keyPoints.map((p) => `- ${p}`).join('\n')}

Sources:
${dossier.sources.map((s) => `- ${s.title}: ${s.excerpt}`).join('\n')}

Competitor Gaps:
${dossier.competitors.flatMap((c) => c.gaps).map((g) => `- ${g}`).join('\n')}

Generate a compelling script with all section types: hook, intro, body, examples, cta, outro.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const content = response.content[0];
  const rawText = 'text' in content
    ? (content as unknown as { text: string }).text
    : 'content' in content
      ? (content as unknown as { content: string }).content
      : '';
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const text = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const parsed = JSON.parse(text) as {
    sections: ScriptSection[];
    title: string;
    description: string;
    tags: string[];
    claudeTokensUsed?: number;
  };

  const totalTokens = response.usage.input_tokens + response.usage.output_tokens;

  return {
    sections: parsed.sections,
    title: parsed.title,
    description: parsed.description,
    tags: parsed.tags,
    claudeTokensUsed: parsed.claudeTokensUsed ?? totalTokens,
  };
}
