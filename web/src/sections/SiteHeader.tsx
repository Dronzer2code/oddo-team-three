import { Brand } from '../components/Brand';
import { config } from '../lib/config';

/**
 * Sits transparently over the forest hero, exactly as the reference does:
 * wordmark left, centred navigation, one mint pill action right.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#employees">For employees</a>
          <a href="#companies">For companies</a>
          <a href="#reviews">Reviews</a>
        </nav>
        <div className="site-header__actions">
          <a className="btn btn-accent" href={`${config.employeeUrl}/login`}>
            Start carpooling
          </a>
        </div>
      </div>
    </header>
  );
}
