// @ts-nocheck — Bundled by Remotion's webpack, not by project tsc
import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

interface ScriptSection {
  type: 'hook' | 'intro' | 'body' | 'examples' | 'cta' | 'outro';
  content: string;
  durationSeconds: number;
}

interface ContentVideoProps {
  sections: ScriptSection[];
  narrationPath: string;
}

const SECTION_COLORS: Record<string, string> = {
  hook: '#1a1a2e',
  intro: '#16213e',
  body: '#0f3460',
  examples: '#1a1a2e',
  cta: '#e94560',
  outro: '#16213e',
};

const SECTION_LABELS: Record<string, string> = {
  hook: '',
  intro: 'Introduction',
  body: '',
  examples: 'Examples',
  cta: '',
  outro: '',
};

function SectionSlide({
  section,
  fps,
}: {
  section: ScriptSection;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const totalFrames = section.durationSeconds * fps;

  // Fade in
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title entrance spring
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  // Text reveal (word by word for body/examples)
  const words = section.content.split(' ');
  const wordsPerFrame = words.length / (totalFrames * 0.7); // Show all words in 70% of duration

  const label = SECTION_LABELS[section.type];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: SECTION_COLORS[section.type] ?? '#1a1a2e',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      {/* Section label */}
      {label && (
        <div
          style={{
            color: '#e94560',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 30,
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * -20}px)`,
          }}
        >
          {label}
        </div>
      )}

      {/* Content text */}
      <div
        style={{
          color: '#ffffff',
          fontSize: section.type === 'hook' || section.type === 'cta' ? 48 : 36,
          fontWeight: section.type === 'hook' || section.type === 'cta' ? 700 : 400,
          lineHeight: 1.5,
          textAlign: 'center',
          maxWidth: 1400,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {words.map((word, i) => {
          const wordOpacity = interpolate(
            frame,
            [i / wordsPerFrame, (i + 1) / wordsPerFrame],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <span key={i} style={{ opacity: wordOpacity }}>
              {word}{' '}
            </span>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 80,
          right: 80,
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(frame / totalFrames) * 100}%`,
            backgroundColor: '#e94560',
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

export const ContentVideo: React.FC<ContentVideoProps> = ({
  sections,
  narrationPath,
}) => {
  const { fps } = useVideoConfig();

  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Narration audio — embedded separately via ffmpeg after render */}

      {/* Section sequences */}
      {sections.map((section, i) => {
        const durationInFrames = Math.round(section.durationSeconds * fps);
        const from = frameOffset;
        frameOffset += durationInFrames;

        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <SectionSlide section={section} fps={fps} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
