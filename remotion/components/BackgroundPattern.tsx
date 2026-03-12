// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { THEME } from '../styles/theme';

interface BackgroundPatternProps {
  sectionType: string;
  durationInFrames: number;
}

export const BackgroundPattern: React.FC<BackgroundPatternProps> = ({
  sectionType,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const colors = THEME.colors.background[sectionType] ?? THEME.colors.background.body;

  // Slowly rotating gradient angle
  const angle = interpolate(frame, [0, durationInFrames], [135, 195], {
    extrapolateRight: 'clamp',
  });

  // Floating accent circles
  const circle1Y = interpolate(frame, [0, durationInFrames], [70, 30], {
    extrapolateRight: 'clamp',
  });
  const circle2Y = interpolate(frame, [0, durationInFrames], [20, 60], {
    extrapolateRight: 'clamp',
  });
  const circle1Opacity = interpolate(frame, [0, 30], [0, 0.06], {
    extrapolateRight: 'clamp',
  });
  const circle2Opacity = interpolate(frame, [0, 45], [0, 0.04], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Gradient background */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`,
        }}
      />

      {/* Floating circle 1 */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: THEME.colors.primary,
          opacity: circle1Opacity,
          top: `${circle1Y}%`,
          right: '-10%',
          filter: 'blur(80px)',
        }}
      />

      {/* Floating circle 2 */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: '#ffffff',
          opacity: circle2Opacity,
          top: `${circle2Y}%`,
          left: '-5%',
          filter: 'blur(60px)',
        }}
      />

      {/* Subtle grid overlay */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </AbsoluteFill>
  );
};
