/**
 * The same design tokens as the web design system, expressed for React Native.
 * Values are kept in sync with packages/ui/src/styles/tokens.css.
 */

export const colors = {
  bg: '#F7F6F2',
  bgSunken: '#F1EFE9',
  surface: '#FFFFFF',
  surfaceInset: '#F7F6F2',

  fg: '#111111',
  fgSecondary: '#5F5F5A',
  fgMuted: '#8C8A84',
  fgInverse: '#FBFAF7',

  border: '#E5E3DE',
  borderStrong: '#D5D2CB',

  accent: '#E4A700',
  accentStrong: '#C99000',
  accentInk: '#4A3600',
  accentSoft: '#FDF4DC',

  danger: '#B3453B',
  dangerSoft: '#F9ECEA',
  warning: '#A8700F',
  warningSoft: '#FBF1E0',
  success: '#2F6B4F',
  successSoft: '#EAF2ED',
  neutralSoft: '#F0EEE9',

  ink: '#141412',
  inkSoft: '#1E1E1B',
  overlay: 'rgba(20, 20, 18, 0.44)',
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
} as const;

export const radius = {
  xs: 2,
  sm: 3,
  md: 6,
  lg: 10,
  pill: 999,
} as const;

/**
 * Satoshi is bundled on web via Fontshare. On device the system sans is used
 * with the same weight ladder — light for display, regular for body, medium for
 * labels and controls. No monospace anywhere.
 */
export const font = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
};

export const type = {
  display: { fontSize: 34, lineHeight: 38, fontWeight: font.light, letterSpacing: -0.8 },
  heading: { fontSize: 26, lineHeight: 30, fontWeight: font.light, letterSpacing: -0.6 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: font.light, letterSpacing: -0.4 },
  subtitle: { fontSize: 16, lineHeight: 21, fontWeight: font.medium },
  body: { fontSize: 15, lineHeight: 22, fontWeight: font.regular },
  small: { fontSize: 13, lineHeight: 18, fontWeight: font.regular },
  label: { fontSize: 11, lineHeight: 14, fontWeight: font.medium, letterSpacing: 1.1 },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: font.regular },
  metric: { fontSize: 30, lineHeight: 33, fontWeight: font.light, letterSpacing: -0.6 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#111111',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#111111',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;
