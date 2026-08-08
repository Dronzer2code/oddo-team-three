import { Icon } from '@carpool/ui';

export function Brand({ inverse }: { inverse?: boolean }) {
  return (
    <a className="brand" href="#top" aria-label="RideSync home">
      <span className="brand__mark" style={inverse ? { background: 'var(--color-accent)', color: 'var(--color-accent-ink)' } : undefined}>
        <Icon name="logo" size={17} />
      </span>
      <span className="brand__name" style={inverse ? { color: 'var(--color-fg-inverse)' } : undefined}>
        Ride<span>Sync</span>
      </span>
    </a>
  );
}
