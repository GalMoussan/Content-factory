import fs from 'node:fs';
import path from 'node:path';
import type { ScriptSection } from '@shared/schemas';

export interface VideoInput {
  readonly sections: readonly ScriptSection[];
  readonly narrationPath: string;
  readonly title?: string;
}

const TITLE_CARD_SECONDS = 3;

export interface VideoResult {
  readonly videoPath: string;
}

/**
 * Assemble a video from script sections and narration audio using Remotion.
 * Bundles the Remotion composition, then renders to assets/video.mp4.
 * Falls back to a placeholder MP4 if Remotion is not available.
 */
export async function assembleVideo(
  input: VideoInput,
  runDir: string,
): Promise<VideoResult> {
  const assetsDir = path.join(runDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const videoPath = path.join(assetsDir, 'video.mp4');

  try {
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');

    const totalDurationSeconds = input.sections.reduce(
      (sum, s) => sum + s.durationSeconds,
      0,
    );

    // Copy narration audio into the Remotion public dir so staticFile() can access it
    const remotionPublicDir = path.join(runDir, 'remotion-public');
    fs.mkdirSync(remotionPublicDir, { recursive: true });
    if (input.narrationPath && fs.existsSync(input.narrationPath)) {
      fs.copyFileSync(
        input.narrationPath,
        path.join(remotionPublicDir, 'narration.mp3'),
      );
    }

    // Bundle the Remotion entry point
    const entryPoint = path.resolve(
      process.cwd(),
      'remotion',
      'index.tsx',
    );
    const bundleLocation = await bundle({
      entryPoint,
      publicDir: remotionPublicDir,
    });

    // Select the composition with runtime props
    const inputProps = {
      sections: [...input.sections],
      narrationPath: 'narration.mp3',
      title: input.title ?? '',
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'ContentVideo',
      inputProps,
    });

    // Override duration: sections + title card
    const totalVideoSeconds = totalDurationSeconds + TITLE_CARD_SECONDS;
    const compositionWithDuration = {
      ...composition,
      durationInFrames: Math.round(totalVideoSeconds * composition.fps),
    };

    // Render the video
    await renderMedia({
      composition: compositionWithDuration,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: videoPath,
      inputProps,
      concurrency: 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Video rendering failed: ${message}`);
  }

  return { videoPath };
}
