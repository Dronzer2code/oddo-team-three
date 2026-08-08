import { Brand } from '../components/Brand';
import { config } from '../lib/config';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <Brand />
          <p className="t-caption" style={{ marginTop: 'var(--space-4)', maxWidth: '34ch' }}>
            An organization-based carpool platform. Rides, trips, cost and audit history in one place.
          </p>
        </div>

        <div>
          <div className="site-footer__title">Product</div>
          <div className="site-footer__links">
            <a href="#how">How it works</a>
            <a href="#employees">For employees</a>
            <a href="#companies">For companies</a>
            <a href="#apps">Applications</a>
          </div>
        </div>

        <div>
          <div className="site-footer__title">Sign in</div>
          <div className="site-footer__links">
            <a href={`${config.employeeUrl}/login`}>Employee app</a>
            <a href={`${config.adminUrl}/login`}>Admin panel</a>
            <a href={`${config.employeeUrl}/register`}>Join your organization</a>
          </div>
        </div>

        <div>
          <div className="site-footer__title">Company</div>
          <div className="site-footer__links">
            <a href="#safety">Safety and privacy</a>
            <a href="#contact">Contact</a>
            <a href="#contact">Request a demo</a>
          </div>
        </div>
      </div>

      <div className="site-footer__bar">
        <div className="site-footer__bar-inner">
          <span>© {new Date().getFullYear()} RideSync. Built for the Odoo hackathon.</span>
          <span className="row" style={{ gap: 'var(--space-4)' }}>
            <a href="#safety">Privacy</a>
            <a href="#safety">Terms</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
