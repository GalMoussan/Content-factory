// @ts-nocheck — Bundled by Remotion's webpack, not by project tsc
import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import { TitleCard } from './components/TitleCard';
import { BackgroundPattern } from './components/BackgroundPattern';
import { AnimatedText } from './components/AnimatedText';
import { SectionLabel } from './components/SectionLabel';
import { ProgressBar } from './components/ProgressBar';

interface ScriptSection {
  type: 'hook' | 'intro' | 'body' | 'examples' | 'cta' | 'outro';
  content: string;
  durationSeconds: number;
}

interface ContentVideoProps {
  sections: ScriptSection[];
  narrationPath: string;
  title?: string;
}

const TITLE_CARD_SECONDS = 3;
const TRANSITION_FRAMES = 12; // 0.4s cross-fade at 30fps

export const ContentVideo: React.FC<ContentVideoProps> = ({
  sections,
  narrationPath,
  title,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const titleDurationFrames = TITLE_CARD_SECONDS * fps;

  // Calculate section frame offsets
  const sectionMeta = sections.map((section) => ({
    section,
    durationInFrames: Math.round(section.durationSeconds * fps),
  }));

  let frameOffset = titleDurationFrames;

  // Build sequence entries with their start frames
  const sequences = sectionMeta.map((meta, i) => {
    const from = frameOffset;
    frameOffset += meta.durationInFrames;
    return { ...meta, from };
  });

  // Cross-fade between sections: fade out last 12 frames, fade in first 12 frames
  const renderSectionFade = (sectionIndex: number, localFrame: number, durationInFrames: number) => {
    // Fade in at start of section
    const fadeIn = interpolate(localFrame, [0, TRANSITION_FRAMES], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Fade out at end of section (except last section)
    const fadeOut =
      sectionIndex < sections.length - 1
        ? interpolate(
            localFrame,
            [durationInFrames - TRANSITION_FRAMES, durationInFrames],
            [1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          )
        : 1;

    return Math.min(fadeIn, fadeOut);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Title Card */}
      <Sequence from={0} durationInFrames={titleDurationFrames}>
        <TitleCard title={title ?? sections[0]?.content ?? ''} />
      </Sequence>

      {/* Narration audio — starts after title card */}
      {narrationPath && (
        <Sequence from={titleDurationFrames}>
          <Audio src={staticFile(narrationPath)} />
        </Sequence>
      )}

      {/* Section sequences */}
      {sequences.map(({ section, from, durationInFrames }, i) => (
        <Sequence key={i} from={from} durationInFrames={durationInFrames}>
          <SectionContent
            section={section}
            sectionIndex={i}
            totalSections={sections.length}
            durationInFrames={durationInFrames}
          />
        </Sequence>
      ))}

      {/* Global progress bar */}
      <ProgressBar
        sections={sections}
        fps={fps}
        titleDurationFrames={titleDurationFrames}
      />
    </AbsoluteFill>
  );
};

/**
 * Individual section with background, label, and animated text.
 * Handles its own fade-in/fade-out transitions.
 */
function SectionContent({
  section,
  sectionIndex,
  totalSections,
  durationInFrames,
}: {
  section: ScriptSection;
  sectionIndex: number;
  totalSections: number;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();

  // Fade transitions
  const fadeIn = interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut =
    sectionIndex < totalSections - 1
      ? interpolate(
          frame,
          [durationInFrames - TRANSITION_FRAMES, durationInFrames],
          [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
      : 1;
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Animated gradient background */}
      <BackgroundPattern
        sectionType={section.type}
        durationInFrames={durationInFrames}
      />

      {/* Section type label */}
      <SectionLabel type={section.type} />

      {/* Main content area */}
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <AnimatedText section={section} totalFrames={durationInFrames} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
