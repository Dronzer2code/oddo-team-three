import { IMAGES } from '@carpool/ui';
import { config } from '../lib/config';

const CAPABILITIES = [
  {
    title: 'Access control',
    text: 'Activate, suspend or reactivate an employee and the change takes effect on the next request — enforced in the API, not just hidden in the interface.',
  },
  {
    title: 'Cost configuration',
    text: 'Fuel price, running cost and vehicle efficiency are versioned with effective dates. Completed trips keep the rate that applied on the day.',
  },
  {
    title: 'Reporting and audit',
    text: 'Distance, litres, cost per kilometre and participation by period, with a full audit log of every administrative change.',
  },
];

/**
 * Benefits for companies, over the reference's full-bleed road photograph with
 * a forest wash: eyebrow and heading left, action right, three columns beneath.
 */
export function ForCompanies() {
  return (
    <section className="band band--forest on-photo" id="companies">
      <div className="band__photo band__photo--soft" aria-hidden="true">
        <img src={IMAGES.openRoad} alt="" />
      </div>
      <div className="band__inner">
        <div className="section-head">
          <div className="section-head__text">
            <span className="eyebrow">For companies</span>
            <h2 className="section-head__title" style={{ marginTop: 'var(--space-4)' }}>
              Run it as an organisation, not an app install.
            </h2>
          </div>
          <a className="btn btn-accent" href={`${config.adminUrl}/login`}>
            Open the admin panel
          </a>
        </div>

        <div className="service-grid">
          {CAPABILITIES.map((capability) => (
            <article key={capability.title}>
              <h3 className="service__title">{capability.title}</h3>
              <p className="service__text">{capability.text}</p>
              <a className="link-arrow" href="#contact">
                Book a walkthrough
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
