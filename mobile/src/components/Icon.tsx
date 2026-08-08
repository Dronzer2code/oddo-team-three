import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * The same stroked 24-grid icon vocabulary as the web design system, drawn with
 * react-native-svg. Paths are copied from packages/ui/src/icons.tsx so the two
 * platforms cannot drift. No emoji, no second icon library.
 */
const PATHS = {
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'],
  car: [
    'M5 17h14M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z',
    'M3 13h18M7.5 16h.01M16.5 16h.01',
  ],
  route: ['M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 9v2a4 4 0 0 1-4 4H6'],
  user: ['M18 20v-1.5A4.5 4.5 0 0 0 13.5 14h-3A4.5 4.5 0 0 0 6 18.5V20', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  users: [
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 1 0 0-6M21 20v-1a3.6 3.6 0 0 0-2.5-3.4',
  ],
  wallet: [
    'M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2',
    'M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z',
    'M17 13.5h.01',
  ],
  bell: ['M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6', 'M13.7 20a2 2 0 0 1-3.4 0'],
  plus: ['M12 5v14M5 12h14'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5M11 18l-6-6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  pin: ['M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  seat: ['M7 4v8a3 3 0 0 0 3 3h4', 'M17 15v3a2 2 0 0 1-2 2H9a4 4 0 0 1-4-4V4'],
  fuel: ['M4 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14', 'M3 20h11M13 9h3a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-2.5-3M7 8h3'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5M12 8v4l3 2'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 8l-4 4 4 4M6 12h10'],
  alert: ['M12 3l9 16H3l9-16Z', 'M12 9v5M12 17h.01'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  play: ['M7 4.5v15l13-7.5-13-7.5Z'],
  flag: ['M5 21V4h10l-1 3h6l-2 6h-6l1 3H5', 'M5 4h0'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.8 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 0Z',
  ],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  color = colors.fg,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

/** Filled star for rating rows — drawn, never a glyph. */
export function Star({ size = 16, color = colors.forest }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.4l2.9 6.2 6.8.8-5 4.6 1.3 6.7-6-3.4-6 3.4 1.3-6.7-5-4.6 6.8-.8z" fill={color} />
    </Svg>
  );
}
