export const THEME = {
  colors: {
    primary: '#e94560',
    primaryDark: '#c23152',
    background: {
      hook: ['#1a1a2e', '#16213e'],
      intro: ['#16213e', '#0f3460'],
      body: ['#0f3460', '#1a1a2e'],
      examples: ['#1a1a2e', '#0f3460'],
      cta: ['#e94560', '#c23152'],
      outro: ['#16213e', '#1a1a2e'],
    } as Record<string, [string, string]>,
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255,255,255,0.6)',
      accent: '#e94560',
    },
  },
  fontSize: {
    hook: 56,
    intro: 40,
    body: 34,
    examples: 34,
    cta: 48,
    outro: 36,
    label: 18,
    title: 64,
    subtitle: 26,
  } as Record<string, number>,
  fontWeight: {
    hook: 700,
    intro: 500,
    body: 400,
    examples: 400,
    cta: 700,
    outro: 400,
  } as Record<string, number>,
  fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
} as const;
