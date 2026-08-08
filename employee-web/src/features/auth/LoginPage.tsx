import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, IMAGES, Icon, Input } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { loginSchema } from '@carpool/shared';
import { useAuth } from '../../lib/auth';
import { config } from '../../lib/api';

const DEMO_ACCOUNTS = [
  { role: 'Driver', email: 'ananya.bose@example.com' },
  { role: 'Passenger', email: 'meera.iyer@example.com' },
  { role: 'Suspended', email: 'imran.sheikh@example.com' },
];

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/home'} replace />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      navigate('/home', { replace: true });
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.isNetworkError
            ? `Cannot reach the API. Make sure the backend is running on ${config.apiUrl}`
            : error.message
          : 'Sign in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__inner">
          <span className="brand">
            <span className="brand__mark">
              <Icon name="logo" size={17} />
            </span>
            <span className="brand__name">
              Ride<span>Sync</span>
            </span>
          </span>

          <h1 className="auth__title">Where are you going today?</h1>
          <p className="auth__lead">Sign in to find a ride with colleagues, or offer the seats in your car.</p>

          <form className="auth__form" onSubmit={submit} noValidate>
            {failure ? <Alert tone="error">{failure}</Alert> : null}

            <Input
              label="Work email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={errors.email}
              autoComplete="username"
              autoFocus
              icon="mail"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />
            <Button type="submit" variant="primary" size="lg" loading={busy} block>
              Sign in
            </Button>
          </form>

          <div className="auth__demo">
            <div className="auth__demo-title">Demo accounts — password Password123!</div>
            <div className="auth__demo-list">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  type="button"
                  className="auth__demo-row"
                  key={account.email}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('Password123!');
                  }}
                >
                  <span className="auth__demo-role">{account.role}</span>
                  <span className="t-muted">{account.email}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="auth__foot">
            New here? <Link to="/register">Join your organization</Link> · Administrator?{' '}
            <a href={`${config.adminUrl}/login`}>Admin panel</a>
          </p>
        </div>
      </div>

      <div className="auth__aside">
        <img src={IMAGES.signIn} alt="" />
        <div className="auth__aside-content">
          <p className="auth__aside-quote">Four empty seats is four cars nobody needed to drive.</p>
          <div className="auth__aside-meta">
            <div>
              <div className="auth__aside-stat-value">Colleagues</div>
              <div className="auth__aside-stat-label">Only your organization</div>
            </div>
            <div>
              <div className="auth__aside-stat-value">Shared cost</div>
              <div className="auth__aside-stat-label">Split automatically</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
