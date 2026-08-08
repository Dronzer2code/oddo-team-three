import type { ReactNode } from 'react';
import { Icon } from '../icons';
import { cx } from './primitives';

/**
 * Transport-specific presentation: route timelines, seat indicators, simple
 * charts. Hand-drawn SVG/CSS so there is no charting dependency and no
 * gradient anywhere.
 */

export function RouteTimeline({
  from,
  to,
  fromLabel = 'Pickup',
  toLabel = 'Destination',
  middle,
}: {
  from: string;
  to: string;
  fromLabel?: string;
  toLabel?: string;
  middle?: ReactNode;
}) {
  return (
    <div className="route">
      <div className="route__marks" aria-hidden="true">
        <span className="route__dot" />
        <span className="route__line" />
        <span className="route__dot route__dot--end" />
      </div>
      <div className="route__stops">
        <div>
          <div className="route__stop-label">{fromLabel}</div>
          <div className="route__stop-name">{from}</div>
        </div>
        <div>{middle}</div>
        <div>
          <div className="route__stop-label">{toLabel}</div>
          <div className="route__stop-name">{to}</div>
        </div>
      </div>
    </div>
  );
}

export function RouteInline({ from, to, className }: { from: string; to: string; className?: string }) {
  return (
    <span className={cx('route--inline', className)}>
      <span className="truncate">{from}</span>
      <span className="route__arrow">
        <Icon name="arrowRight" size={14} />
      </span>
      <span className="truncate">{to}</span>
    </span>
  );
}

/** Seat pips: taken seats filled dark, free seats amber. */
export function Seats({ total, taken }: { total: number; taken: number }) {
  const safeTotal = Math.max(0, Math.min(total, 12));
  return (
    <span className="seats" title={`${Math.max(0, total - taken)} of ${total} seats free`}>
      {Array.from({ length: safeTotal }).map((_, index) => (
        <span
          key={index}
          className={cx('seats__pip', index < taken ? 'seats__pip--taken' : 'seats__pip--free')}
        />
      ))}
    </span>
  );
}

export interface BarChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

/**
 * One chart type, used only where a trend is genuinely useful.
 * Bars are ink; the current period is amber.
 */
export function BarChart({
  points,
  format = (value: number) => String(value),
  highlightLast = true,
  height = 168,
}: {
  points: BarChartPoint[];
  format?: (value: number) => string;
  highlightLast?: boolean;
  height?: number;
}) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.value, point.secondary ?? 0)));

  return (
    <div className="chart">
      <div className="chart__bars" style={{ height }}>
        {points.map((point, index) => {
          const isLast = index === points.length - 1;
          return (
            <div className="chart__col" key={`${point.label}-${index}`}>
              <span className="t-caption" style={{ fontSize: 11 }}>
                {point.value > 0 ? format(point.value) : ''}
              </span>
              <div
                className={cx('chart__bar', highlightLast && isLast && 'chart__bar--accent')}
                style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                title={`${point.label}: ${format(point.value)}`}
              />
              <span className="chart__col-label">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Meter({
  value,
  max = 100,
  accent,
  label,
}: {
  value: number;
  max?: number;
  accent?: boolean;
  label?: string;
}) {
  const percent = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      {label ? (
        <div className="row-between t-caption" style={{ marginBottom: 6 }}>
          <span>{label}</span>
          <span className="t-medium">{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        className="meter"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cx('meter__fill', accent && 'meter__fill--accent')} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ChartLegend({ keys }: { keys: Array<{ label: string; tone?: 'ink' | 'muted' | 'accent' }> }) {
  return (
    <div className="chart-legend">
      {keys.map((key) => (
        <span className="chart-legend__key" key={key.label}>
          <span
            className={cx(
              'chart-legend__swatch',
              key.tone === 'muted' && 'chart-legend__swatch--muted',
              key.tone === 'accent' && 'chart-legend__swatch--accent',
            )}
          />
          {key.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Stock automotive/commute photography, monochrome via CSS. Centralised so
 * every application pulls from the same small, deliberate set.
 */
export const IMAGES = {
  heroCommute:
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=70',
  cityDriving:
    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=70',
  carInterior:
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=70',
  passengers:
    'https://images.unsplash.com/photo-1531971589569-0d9370cbe1e5?auto=format&fit=crop&w=1200&q=70',
  roadAerial:
    'https://images.unsplash.com/photo-1494783367193-149034c05e8f?auto=format&fit=crop&w=1200&q=70',
  parking:
    'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=70',
  keys: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=70',
  fleet:
    'https://images.unsplash.com/photo-1567818735868-e71b99932e29?auto=format&fit=crop&w=1200&q=70',
  signIn:
    'https://images.unsplash.com/photo-1485291571150-772bcfc10da5?auto=format&fit=crop&w=1200&q=70',
  adminSignIn:
    'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=70',
} as const;

const VEHICLE_IMAGES: Record<string, string> = {
  sedan: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=70',
  hatchback: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=800&q=70',
  suv: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=70',
  van: 'https://images.unsplash.com/photo-1600661653561-629509216228?auto=format&fit=crop&w=800&q=70',
  bike: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=70',
};

export function vehicleImage(vehicleType: string | null | undefined): string {
  return VEHICLE_IMAGES[vehicleType ?? 'sedan'] ?? VEHICLE_IMAGES.sedan!;
}
