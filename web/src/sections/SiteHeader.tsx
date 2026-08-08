import { Button } from '@carpool/ui';
import { Brand } from '../components/Brand';
import { config } from '../lib/config';

export function SiteHeader() {
  return (
    <header className="site-header" id="top">
      <div className="site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#employees">For employees</a>
          <a href="#companies">For companies</a>
          <a href="#safety">Safety</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="site-header__actions">
          <Button variant="ghost" size="sm" onClick={() => window.location.assign(`${config.adminUrl}/login`)}>
            Admin sign in
          </Button>
          <Button variant="primary" size="sm" iconAfter="arrowRight" onClick={() => window.location.assign(`${config.employeeUrl}/login`)}>
            Employee sign in
          </Button>
        </div>
      </div>
    </header>
  );
}
