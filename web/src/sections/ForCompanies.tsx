import { Icon, type IconName } from '@carpool/ui';

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'users',
    title: 'Employee access control',
    text: 'Invite, activate, suspend or deactivate. A suspended employee cannot publish or request a ride — enforced on the server, not just hidden in the interface.',
  },
  {
    icon: 'car',
    title: 'Vehicle register',
    text: 'Approve vehicles before they carry colleagues. Registration numbers are unique per organization, and retiring a vehicle never erases its trip history.',
  },
  {
    icon: 'fuel',
    title: 'Versioned cost configuration',
    text: 'Fuel price, running cost and fuel efficiency are versioned with effective dates. Yesterday’s report does not move when today’s price changes.',
  },
  {
    icon: 'chart',
    title: 'Participation you can act on',
    text: 'Who published, who requested, who actually travelled — weekly and monthly, with the participation rate for the period.',
  },
  {
    icon: 'trend',
    title: 'Cost and distance reporting',
    text: 'Trips, distance, fuel, cost per kilometre, cost by vehicle and driver activity. Canceled rides are counted separately and never inflate the numbers.',
  },
  {
    icon: 'history',
    title: 'Full audit history',
    text: 'Every access change, vehicle decision and configuration edit is recorded with the actor, the timestamp and the before and after values.',
  },
];

export function ForCompanies() {
  return (
    <section className="section section--ink" id="companies">
      <div className="section__inner" style={{ padding: '0 var(--site-gutter)' }}>
        <div className="section__head">
          <span className="eyebrow">For companies</span>
          <h2 className="section__title" style={{ color: 'var(--color-fg-inverse)' }}>
            An operations console, not a second employee app.
          </h2>
          <p className="section__lead">
            The admin panel does the four things a transport programme actually needs: control access, keep
            the vehicle register honest, configure cost, and report on it.
          </p>
        </div>

        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article className="feature" key={feature.title}>
              <span className="feature__icon">
                <Icon name={feature.icon} size={17} />
              </span>
              <h3 className="feature__title" style={{ color: 'var(--color-fg-inverse)' }}>
                {feature.title}
              </h3>
              <p className="feature__text">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
