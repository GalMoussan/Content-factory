import fs from 'node:fs';
import path from 'node:path';
import type { ScriptSection } from '@shared/schemas';

export interface TTSConfig {
  readonly subscriptionKey: string;
  readonly region: string;
  readonly voice: string;
}

export interface NarrationResult {
  readonly narrationPath: string;
  readonly durationSeconds: number;
}

/**
 * Generate TTS narration from script sections using Azure TTS.
 * Saves the audio file to assets/narration.mp3 in the run directory.
 */
export async function generateNarration(
  sections: readonly ScriptSection[],
  runDir: string,
  config: TTSConfig,
): Promise<NarrationResult> {
  const fullText = sections.map((s) => s.content).join(' ');
  const totalDuration = sections.reduce((sum, s) => sum + s.durationSeconds, 0);

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${config.voice}">
    ${fullText}
  </voice>
</speak>`;

  const endpoint = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.subscriptionKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    body: ssml,
  });

  if (!response.ok) {
    throw new Error(`Azure TTS failed: ${response.status} ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const assetsDir = path.join(runDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const narrationPath = path.join(assetsDir, 'narration.mp3');
  fs.writeFileSync(narrationPath, Buffer.from(audioBuffer));

  return {
    narrationPath,
    durationSeconds: totalDuration,
  };
}
