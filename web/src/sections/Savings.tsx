import { Icon } from '@carpool/ui';

/**
 * Illustrative arithmetic, clearly labelled as such — the real numbers come
 * from each organization's own configuration and completed trips.
 */
const EXAMPLE = {
  distanceKm: 12.4,
  mileage: 15.5,
  fuelPrice: 104.5,
  runningCost: 2.2,
};

function currency(value: number): string {
  return `₹${value.toFixed(0)}`;
}

export function Savings() {
  const litres = EXAMPLE.distanceKm / EXAMPLE.mileage;
  const total = litres * EXAMPLE.fuelPrice + EXAMPLE.distanceKm * EXAMPLE.runningCost;
  const soloMonthly = total * 2 * 22;
  const sharedMonthly = (total / 3) * 2 * 22;

  return (
    <section className="section section--sunken">
      <div className="section__inner">
        <div className="section__head">
          <span className="eyebrow">Cost and sustainability</span>
          <h2 className="section__title">Three people, one engine.</h2>
          <p className="section__lead">
            A shared car is the cheapest transport decision available to most teams, and the only one that
            reduces both cost and emissions at the same time. Here is the arithmetic on a 12.4 km commute at
            ₹104.50 a litre.
          </p>
        </div>

        <div className="grid grid-3">
          <article className="card">
            <div className="card-body stack">
              <span className="t-label">Driving alone</span>
              <div className="t-metric">{currency(soloMonthly)}</div>
              <p className="t-caption">Per person, per month, return trip, 22 working days.</p>
            </div>
          </article>
          <article className="card">
            <div className="card-body stack">
              <span className="t-label">Sharing with two colleagues</span>
              <div className="t-metric">{currency(sharedMonthly)}</div>
              <p className="t-caption">Same commute, cost split across the people actually in the car.</p>
            </div>
          </article>
          <article className="card">
            <div className="card-body stack">
              <span className="t-label">Cars off the road</span>
              <div className="t-metric">2 of 3</div>
              <p className="t-caption">
                <Icon name="leaf" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                Two thirds fewer vehicles making the same journey.
              </p>
            </div>
          </article>
        </div>

        <p className="t-caption" style={{ marginTop: 'var(--space-5)' }}>
          Illustrative figures. Inside the platform every number is computed from your own cost configuration
          and your own completed trips.
        </p>
      </div>
    </section>
  );
}
