import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, AuthLayout, Button, IMAGES, Input } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { loginSchema } from '@carpool/shared';
import { useAuth } from '../../lib/auth';
import { config } from '../../lib/api';

const DEMO_ACCOUNTS = [
  { role: 'Driver', email: 'ananya.bose@example.com' },
  { role: 'Passenger', email: 'meera.iyer@example.com' },
  { role: 'Suspended', email: 'imran.sheikh@example.com' },
];

const PROOF = [
  { value: 'Colleagues', label: 'Only your organisation' },
  { value: 'Split', label: 'Cost shared per seat' },
  { value: 'Both', label: 'Drive or ride, one account' },
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
    <AuthLayout
      eyebrow="Employee access"
      title="Where are you going today?"
      lead="Sign in to find a ride with colleagues, or offer the seats you were driving with empty anyway."
      claim="Four empty seats is four cars nobody needed to drive."
      claimText="Publish the drive you were making anyway. RideSync splits the fuel and running cost across everyone on board, at your organisation's own rates."
      proof={PROOF}
      photo={IMAGES.signIn}
      footer={
        <span>
          <Link to="/register">Join your organisation</Link> ·{' '}
          <a href={`${config.adminUrl}/login`}>Admin panel</a>
        </span>
      }
    >
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
          placeholder="you@company.com"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="current-password"
          placeholder="••••••••"
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
    </AuthLayout>
  );
}
