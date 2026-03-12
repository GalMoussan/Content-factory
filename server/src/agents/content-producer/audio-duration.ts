import { parseMedia } from '@remotion/media-parser';
import { nodeReader } from '@remotion/media-parser/node';

/**
 * Measure the actual duration of an audio file (MP3, WAV, etc.)
 * using Remotion's media parser.
 */
export async function getAudioDurationSeconds(filePath: string): Promise<number> {
  const result = await parseMedia({
    src: filePath,
    fields: { slowDurationInSeconds: true },
    reader: nodeReader,
  });
  return result.slowDurationInSeconds;
}
