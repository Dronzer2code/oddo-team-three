import { Icon, type IconName } from '@carpool/ui';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'car',
    title: 'Publish in three taps',
    text: 'Pick a vehicle, set the departure time and the number of seats. RideSync works out the distance, the fuel used and the cost per seat.',
  },
  {
    icon: 'building',
    title: 'Matched inside your org',
    text: 'Only colleagues in the same organisation can see a ride. No public marketplace, no strangers, no shared phone numbers.',
  },
  {
    icon: 'chart',
    title: 'Reported, not guessed',
    text: 'Distance, litres, cost per kilometre and participation are computed from completed trips using the rates that applied on the day.',
  },
];

/**
 * Product explanation on the mint band: heading left, lead and action right,
 * three white feature cards beneath — the reference's second section.
 */
export function Mission() {
  return (
    <section className="band band--mint" id="product">
      <div className="band__inner">
        <div className="section-head">
          <div className="section-head__text">
            <h2 className="section-head__title">
              We are rebuilding the commute around the cars you already own.
            </h2>
          </div>
          <div>
            <p className="section-head__lead">
              Built for organisations rather than the open street: one company, one set of rules, and a full
              audit trail behind every change.
            </p>
            <a className="btn btn-primary" href="#how" style={{ marginTop: 'var(--space-5)' }}>
              How it works
            </a>
          </div>
        </div>

        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article className="feature" key={feature.title}>
              <span className="feature__icon">
                <Icon name={feature.icon} size={26} />
              </span>
              <h3 className="feature__title">{feature.title}</h3>
              <p className="feature__text">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
