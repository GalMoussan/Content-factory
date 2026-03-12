// @ts-nocheck
import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { THEME } from '../styles/theme';

interface ScriptSection {
  type: string;
  content: string;
  durationSeconds: number;
}

interface AnimatedTextProps {
  section: ScriptSection;
  totalFrames: number;
}

/**
 * For hook/cta sections: word-by-word reveal with spring slide-up.
 * For body/examples/intro/outro: line-by-line reveal with slide-from-left.
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({ section, totalFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isEmphasis = section.type === 'hook' || section.type === 'cta';
  const fontSize = THEME.fontSize[section.type] ?? 34;
  const fontWeight = THEME.fontWeight[section.type] ?? 400;

  if (isEmphasis) {
    return (
      <WordByWordReveal
        text={section.content}
        totalFrames={totalFrames}
        fps={fps}
        frame={frame}
        fontSize={fontSize}
        fontWeight={fontWeight}
      />
    );
  }

  return (
    <LineByLineReveal
      text={section.content}
      totalFrames={totalFrames}
      fps={fps}
      frame={frame}
      fontSize={fontSize}
      fontWeight={fontWeight}
    />
  );
};

function WordByWordReveal({
  text,
  totalFrames,
  fps,
  frame,
  fontSize,
  fontWeight,
}: {
  text: string;
  totalFrames: number;
  fps: number;
  frame: number;
  fontSize: number;
  fontWeight: number;
}) {
  const words = text.split(' ');
  // Distribute words evenly across 85% of the section duration
  const revealWindow = totalFrames * 0.85;
  const framesPerWord = revealWindow / words.length;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px 12px',
        maxWidth: 1400,
        padding: '0 80px',
      }}
    >
      {words.map((word, i) => {
        const wordStartFrame = i * framesPerWord;
        const progress = spring({
          frame: Math.max(0, frame - wordStartFrame),
          fps,
          config: { damping: 16, stiffness: 140 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const translateY = interpolate(progress, [0, 1], [12, 0]);

        return (
          <span
            key={i}
            style={{
              color: THEME.colors.text.primary,
              fontSize,
              fontWeight,
              fontFamily: THEME.fontFamily,
              lineHeight: 1.4,
              opacity,
              transform: `translateY(${translateY}px)`,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

function LineByLineReveal({
  text,
  totalFrames,
  fps,
  frame,
  fontSize,
  fontWeight,
}: {
  text: string;
  totalFrames: number;
  fps: number;
  frame: number;
  fontSize: number;
  fontWeight: number;
}) {
  // Split into lines (~12 words each)
  const words = text.split(' ');
  const wordsPerLine = 12;
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }

  const revealWindow = totalFrames * 0.85;
  const framesPerLine = revealWindow / lines.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        maxWidth: 1400,
        padding: '0 80px',
      }}
    >
      {lines.map((line, i) => {
        const lineStartFrame = i * framesPerLine;
        const progress = spring({
          frame: Math.max(0, frame - lineStartFrame),
          fps,
          config: { damping: 18, stiffness: 100 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const translateX = interpolate(progress, [0, 1], [-20, 0]);

        return (
          <div
            key={i}
            style={{
              color: THEME.colors.text.primary,
              fontSize,
              fontWeight,
              fontFamily: THEME.fontFamily,
              lineHeight: 1.6,
              textAlign: 'center',
              opacity,
              transform: `translateX(${translateX}px)`,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}
