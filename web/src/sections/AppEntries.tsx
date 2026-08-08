import { Icon } from '@carpool/ui';
import { config } from '../lib/config';

export function AppEntries() {
  const entries = [
    {
      title: 'Employee web app',
      text: 'Find a ride, publish a ride, manage your trips and vehicles.',
      href: `${config.employeeUrl}/login`,
      cta: 'Sign in',
    },
    {
      title: 'Admin panel',
      text: 'Employees, vehicles, drivers, cost configuration, participation and reports.',
      href: `${config.adminUrl}/login`,
      cta: 'Sign in',
    },
    {
      title: 'Mobile app',
      text: 'The same rides and trips on React Native, using the same API and the same rules.',
      href: '#contact',
      cta: 'Request access',
    },
  ];

  return (
    <section className="section section--tight" id="apps">
      <div className="section__head">
        <span className="eyebrow">Where to sign in</span>
        <h2 className="section__title">Three front doors, one backend.</h2>
      </div>

      <div className="entry-grid">
        {entries.map((entry) => (
          <a className="entry" href={entry.href} key={entry.title}>
            <span className="entry__title">
              {entry.title}
              <Icon name="arrowRight" size={16} />
            </span>
            <span className="entry__text">{entry.text}</span>
            <span className="t-label" style={{ marginTop: 'var(--space-3)' }}>
              {entry.cta}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
