import type { SVGProps } from 'react';

/**
 * One icon system for all four applications — stroked, 24-grid, currentColor.
 * No second icon library anywhere in the platform.
 */

const PATHS: Record<string, string[]> = {
  car: [
    'M5 17h14M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z',
    'M3 13h18M7.5 16h.01M16.5 16h.01',
  ],
  route: ['M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 9v2a4 4 0 0 1-4 4H6'],
  pin: ['M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  users: ['M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1', 'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 1 0 0-6M21 20v-1a3.6 3.6 0 0 0-2.5-3.4'],
  user: ['M18 20v-1.5A4.5 4.5 0 0 0 13.5 14h-3A4.5 4.5 0 0 0 6 18.5V20', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  seat: ['M7 4v8a3 3 0 0 0 3 3h4', 'M17 15v3a2 2 0 0 1-2 2H9a4 4 0 0 1-4-4V4'],
  wallet: ['M3 8a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2', 'M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z', 'M17 13.5h.01'],
  fuel: ['M4 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14', 'M3 20h11M13 9h3a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-2.5-3M7 8h3'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.8 1.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 0Z',
  ],
  bell: ['M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6', 'M13.7 20a2 2 0 0 1-3.4 0'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  arrowLeft: ['M19 12H5M11 18l-6-6 6-6'],
  arrowUp: ['M12 19V5M6 11l6-6 6 6'],
  arrowDown: ['M12 5v14M18 13l-6 6-6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  chart: ['M4 20V4M4 20h16', 'M8 16v-4M12.5 16V8M17 16v-6'],
  trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  shield: ['M12 21s7-3.2 7-9V6l-7-3-7 3v6c0 5.8 7 9 7 9Z', 'M9.5 12l1.8 1.8 3.4-3.6'],
  leaf: ['M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16Z', 'M4 20c2-4 5-6.5 9-8'],
  building: ['M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16', 'M15 9h3a2 2 0 0 1 2 2v10M3 21h18M8 7h3M8 11h3M8 15h3'],
  phone: ['M15.5 21A13.5 13.5 0 0 1 3 8.5V6a2 2 0 0 1 2-2h2l1.5 4-2 1.5a10 10 0 0 0 4.5 4.5L12.5 12l4 1.5V16a2 2 0 0 1-2 2h-.5'],
  mail: ['M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z', 'm3.5 7.5 8.5 6 8.5-6'],
  logout: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 8l-4 4 4 4M6 12h10'],
  edit: ['M4 20h4L20 8l-4-4L4 16v4Z', 'M14 6l4 4'],
  filter: ['M4 6h16M7 12h10M10 18h4'],
  calendar: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z', 'M4 10h16M9 3v4M15 3v4'],
  download: ['M12 4v11M7 11l5 5 5-5', 'M5 20h14'],
  upload: ['M12 20V9M7 13l5-5 5 5', 'M5 4h14'],
  alert: ['M12 3l9 16H3l9-16Z', 'M12 9v5M12 17h.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5M12 8h.01'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  pause: ['M9 5v14M15 5v14'],
  play: ['M7 4.5v15l13-7.5-13-7.5Z'],
  flag: ['M5 21V4h10l-1 3h6l-2 6h-6l1 3H5', 'M5 4h0'],
  home: ['M4 11l8-7 8 7', 'M6 10v10h12V10'],
  list: ['M4 6h.01M4 12h.01M4 18h.01M9 6h11M9 12h11M9 18h11'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5M12 8v4l3 2'],
  logo: ['M4 15l1.6-4.8A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.2L20 15v3h-2.5', 'M4 18v-3M8 18h8M6.5 15h11'],
  external: ['M14 5h5v5', 'M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4'],
  eye: ['M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  copy: ['M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z', 'M6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1'],
};

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.6, ...rest }: IconProps) {
  const paths = PATHS[name] ?? PATHS.info!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
