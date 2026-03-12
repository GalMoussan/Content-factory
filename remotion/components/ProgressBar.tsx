// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { THEME } from '../styles/theme';

interface Section {
  type: string;
  content: string;
  durationSeconds: number;
}

interface ProgressBarProps {
  sections: readonly Section[];
  fps: number;
  titleDurationFrames: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  sections,
  fps,
  titleDurationFrames,
}) => {
  const frame = useCurrentFrame();

  // Calculate total section frames and segment boundaries
  const segmentFrames = sections.map((s) => Math.round(s.durationSeconds * fps));
  const totalSectionFrames = segmentFrames.reduce((sum, f) => sum + f, 0);

  // Current position relative to sections (after title card)
  const sectionFrame = Math.max(0, frame - titleDurationFrames);

  // Fade in the bar after title card
  const barOpacity = interpolate(
    frame,
    [titleDurationFrames, titleDurationFrames + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  let accumulated = 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: 60,
          right: 60,
          height: 3,
          display: 'flex',
          gap: 3,
          opacity: barOpacity,
        }}
      >
        {segmentFrames.map((segFrames, i) => {
          const segStart = accumulated;
          accumulated += segFrames;

          // How far into this segment are we?
          const segProgress = interpolate(
            sectionFrame,
            [segStart, segStart + segFrames],
            [0, 100],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          const isComplete = sectionFrame >= segStart + segFrames;
          const isActive = sectionFrame >= segStart && !isComplete;

          return (
            <div
              key={i}
              style={{
                flex: segFrames / totalSectionFrames,
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: isComplete ? '100%' : `${segProgress}%`,
                  backgroundColor: isActive
                    ? THEME.colors.primary
                    : isComplete
                      ? 'rgba(255,255,255,0.3)'
                      : 'transparent',
                  borderRadius: 2,
                  transition: 'background-color 0.1s',
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
