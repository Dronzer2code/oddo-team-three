import { useState } from 'react';
import { Button } from '@carpool/ui';
import { config } from '../lib/config';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how' },
      { label: 'For employees', href: '#employees' },
      { label: 'For companies', href: '#companies' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Vehicles', href: '#fleet' },
      { label: 'Safety', href: '#safety' },
      { label: 'Cost and carbon', href: '#savings' },
    ],
  },
  {
    title: 'Sign in',
    links: [
      { label: 'Employee app', href: `${config.employeeUrl}/login` },
      { label: 'Admin panel', href: `${config.adminUrl}/login` },
      { label: 'Mobile build', href: '#apps' },
    ],
  },
];

/**
 * Footer on the reference's inset faint panel: claim and a forest contact pill
 * left, newsletter capture right, then legal line and three link columns.
 */
export function SiteFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="site-footer">
      <div className="site-footer__panel">
        <div className="site-footer__top">
          <div>
            <h2 className="site-footer__title">
              The commuting layer for organisations that already own the cars.
            </h2>
            <a className="btn btn-primary btn-lg" href="#contact" style={{ marginTop: 'var(--space-7)' }}>
              Contact us
            </a>
          </div>

          <div>
            <h3 className="site-footer__subtitle">Product notes, once a month. Nothing else.</h3>
            <form
              className="subscribe"
              onSubmit={(event) => {
                event.preventDefault();
                // Newsletter capture is a front-of-site convenience; it is not
                // wired to a tenant mailing list in the MVP.
                if (email.includes('@')) setSubscribed(true);
              }}
            >
              <input
                className="form-control"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address*"
                aria-label="Email address"
              />
              <Button type="submit" variant="primary" size="lg">
                Subscribe
              </Button>
            </form>
            {subscribed ? (
              <p className="t-caption" style={{ marginTop: 'var(--space-3)' }} role="status">
                Thanks — you are on the list.
              </p>
            ) : null}
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__legal">
            © {new Date().getFullYear()} RideSync. All rights reserved.
            <br />
            Built for the Odoo hackathon. Demo data only.
          </p>
          <div className="site-footer__cols">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <div className="site-footer__links">
                  {column.links.map((link) => (
                    <a key={link.label} href={link.href}>
                      {link.label}
                    </a>
                  ))}
                </div>
              </nav>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
