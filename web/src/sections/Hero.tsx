import { Button, IMAGES, Icon } from '@carpool/ui';
import { config } from '../lib/config';

const STATS = [
  { value: '4 seats', label: 'Empty on the average solo commute' },
  { value: '1 platform', label: 'Rides, trips, cost and audit history' },
  { value: '2 minutes', label: 'From publishing a ride to a filled car' },
  { value: '0 spreadsheets', label: 'Participation and cost reporting built in' },
];

export function Hero() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Employee carpool platform</span>
          <h1 className="hero__title">
            Carpooling
            <br />
            without the <strong>chaos</strong>.
          </h1>
          <p className="hero__lead">
            Your team already drives the same roads at the same time. RideSync turns those overlapping
            commutes into shared rides — and gives the company a clear view of participation, distance,
            fuel and cost without chasing anybody for a spreadsheet.
          </p>
          <div className="hero__actions">
            <Button
              variant="primary"
              size="lg"
              iconAfter="arrowRight"
              onClick={() => window.location.assign(`${config.employeeUrl}/login`)}
            >
              Find your first ride
            </Button>
            <Button variant="secondary" size="lg" onClick={() => document.getElementById('contact')?.scrollIntoView()}>
              Request a demo
            </Button>
          </div>
          <p className="t-caption" style={{ marginTop: 'var(--space-5)' }}>
            <Icon name="shield" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            Organization-scoped by design. Employees only ever see their own company.
          </p>
        </div>

        <div className="hero__media">
          <img
            src={IMAGES.heroCommute}
            alt="Cars queueing on a city road during the morning commute"
            loading="eager"
          />
          <div className="hero__media-caption">
            <span className="row" style={{ gap: 8 }}>
              <Icon name="route" size={15} />
              <span className="t-medium">Salt Lake → Park Street</span>
            </span>
            <span className="t-muted">08:30 · 12.4 km · 3 seats</span>
          </div>
        </div>
      </section>

      <div className="stat-strip">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <div className="stat-strip__value">{stat.value}</div>
            <div className="stat-strip__label">{stat.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}
