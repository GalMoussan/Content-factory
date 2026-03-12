// @ts-nocheck
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { THEME } from '../styles/theme';

const LABELS: Record<string, string> = {
  intro: 'INTRODUCTION',
  body: 'DEEP DIVE',
  examples: 'EXAMPLES',
  cta: 'SUBSCRIBE',
};

interface SectionLabelProps {
  type: string;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ type }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const label = LABELS[type];

  if (!label) return null;

  const progress = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [-15, 0]);

  const isCta = type === 'cta';

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 80,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-block',
          padding: '6px 18px',
          borderRadius: 20,
          background: isCta ? THEME.colors.primary : 'rgba(255,255,255,0.1)',
          border: `1px solid ${isCta ? THEME.colors.primary : 'rgba(255,255,255,0.15)'}`,
          color: THEME.colors.text.primary,
          fontSize: THEME.fontSize.label,
          fontWeight: 600,
          fontFamily: THEME.fontFamily,
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
};
