// @ts-nocheck
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { THEME } from '../styles/theme';

interface TitleCardProps {
  title: string;
}

export const TitleCard: React.FC<TitleCardProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title spring animation
  const titleProgress = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);

  // Accent line expansion (starts after title)
  const lineProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 18, stiffness: 120 },
  });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 300]);

  // Subtitle fade-in (delayed)
  const subtitleOpacity = interpolate(frame, [25, 45], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(145deg, #0a0a1a, #16213e)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      {/* Decorative blur */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: THEME.colors.primary,
          opacity: 0.08,
          top: '20%',
          right: '10%',
          filter: 'blur(100px)',
        }}
      />

      {/* Title */}
      <div
        style={{
          color: THEME.colors.text.primary,
          fontSize: THEME.fontSize.title,
          fontWeight: 700,
          fontFamily: THEME.fontFamily,
          textAlign: 'center',
          maxWidth: 1400,
          lineHeight: 1.2,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>

      {/* Accent line */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${THEME.colors.primary}, transparent)`,
          marginTop: 30,
          borderRadius: 2,
        }}
      />

      {/* Channel branding */}
      <div
        style={{
          color: THEME.colors.text.secondary,
          fontSize: THEME.fontSize.subtitle,
          fontWeight: 400,
          fontFamily: THEME.fontFamily,
          marginTop: 24,
          opacity: subtitleOpacity,
          letterSpacing: 2,
        }}
      >
        AI / TECH
      </div>
    </AbsoluteFill>
  );
};
