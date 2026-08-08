import { portraitFor } from '@carpool/ui';
import { Stars } from '../components/Stars';

const QUOTES = [
  {
    text: 'I was driving in alone from Salt Lake every morning. Now there are three of us in the car and the fuel is split before I get home.',
    name: 'Ananya Rao',
    role: 'Design, Meridian Works',
  },
  {
    text: 'Suspending an account actually stops the person publishing. That was the thing our last tool never got right.',
    name: 'Farhan Qureshi',
    role: 'Facilities lead',
  },
  {
    text: 'The reports match what we pay out, because the rate is frozen onto the trip when it starts. Month-end takes minutes.',
    name: 'Devika Menon',
    role: 'Finance operations',
  },
];

const PARTNERS = ['Meridian Works', 'Northgate Labs', 'Fairwind Retail', 'Halcyon Health', 'Brightline Rail'];

/**
 * Customer reviews on an inset faint panel: three mint quote cards, a centred
 * rating, then a row of partner wordmarks — set in type rather than as logo
 * images, since these are fictional demo organisations.
 */
export function Reviews() {
  return (
    <section
      id="reviews"
      style={{
        background: 'var(--color-bg)',
        paddingBlock: 'var(--panel-inset)',
      }}
    >
      <div className="panel panel--faint">
        <div className="panel__inner">
          <div className="section-head">
            <div className="section-head__text">
              <span className="eyebrow">Customer reviews</span>
              <h2 className="section-head__title" style={{ marginTop: 'var(--space-4)' }}>
                Why mobility teams keep it running.
              </h2>
            </div>
            <a className="btn btn-primary" href="#contact">
              Talk to a customer
            </a>
          </div>

          <div className="quote-grid">
            {QUOTES.map((quote) => (
              <figure className="quote" key={quote.name}>
                <span className="quote__stars">
                  <Stars size={16} />
                </span>
                <blockquote className="quote__text">{quote.text}</blockquote>
                <figcaption className="quote__author">
                  <img src={portraitFor(quote.name)} alt="" aria-hidden="true" />
                  <span>
                    <span className="quote__name">{quote.name}</span>
                    <span className="t-caption" style={{ display: 'block' }}>
                      {quote.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="rating rating--center" style={{ marginTop: 'clamp(2.5rem, 5vw, 3.5rem)' }}>
            <Stars />
            <p className="rating__caption">Rated 4.8 by 2,400+ commuters across 40 campuses</p>
          </div>

          <div className="logo-row">
            {PARTNERS.map((partner) => (
              <span key={partner} className="logo-mark">
                {partner}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
