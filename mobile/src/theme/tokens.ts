/**
 * The same design tokens as the web design system, expressed for React Native.
 * Values are kept in sync with packages/ui/src/styles/tokens.css — forest
 * #1e4927 as ink and text, mint #c5edcb as the accent surface, white ground.
 */

export const colors = {
  forest: '#1E4927',
  mint: '#C5EDCB',

  bg: '#FFFFFF',
  bgSunken: '#F2FAF4',
  surface: '#FFFFFF',
  surfaceInset: '#F2FAF4',

  fg: '#1E4927',
  fgSecondary: 'rgba(30, 73, 39, 0.7)',
  fgMuted: 'rgba(30, 73, 39, 0.52)',
  fgFaint: 'rgba(30, 73, 39, 0.3)',
  fgInverse: '#FFFFFF',
  fgOnInkMuted: 'rgba(255, 255, 255, 0.68)',

  border: '#E0EFE4',
  borderStrong: '#C9E3CE',
  borderInverse: 'rgba(197, 237, 203, 0.22)',

  accent: '#C5EDCB',
  accentStrong: '#B2E5BA',
  accentInk: '#1E4927',
  accentSoft: '#E4F6E8',
  accentFaint: '#F2FAF4',

  danger: '#A4322A',
  dangerSoft: '#FBECEB',
  warning: '#8A5C00',
  warningSoft: '#FBF3E2',
  success: '#14683A',
  successSoft: '#E6F4EA',
  neutralSoft: '#EEF5F0',

  ink: '#1E4927',
  inkSoft: '#24562E',
  inkDeep: '#143019',
  overlay: 'rgba(20, 48, 25, 0.5)',
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
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 20,
  pill: 999,
} as const;

/**
 * Inter is bundled on web from packages/ui/assets/fonts. On device the system
 * sans carries the same weight ladder — light for display, regular for body,
 * medium for labels and controls. No monospace anywhere.
 */
export const font = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
};

/**
 * The reference's tight negative tracking, converted from em to points at each
 * size (-0.04em on display, -0.032em on body).
 */
export const type = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: font.regular, letterSpacing: -1.4 },
  heading: { fontSize: 26, lineHeight: 31, fontWeight: font.regular, letterSpacing: -1 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: font.regular, letterSpacing: -0.7 },
  subtitle: { fontSize: 16, lineHeight: 21, fontWeight: font.medium, letterSpacing: -0.5 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: font.regular, letterSpacing: -0.5 },
  small: { fontSize: 14, lineHeight: 20, fontWeight: font.light, letterSpacing: -0.45 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: font.medium, letterSpacing: 1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: font.regular, letterSpacing: -0.4 },
  metric: { fontSize: 32, lineHeight: 38, fontWeight: font.medium, letterSpacing: -1 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#1E4927',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#1E4927',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;
