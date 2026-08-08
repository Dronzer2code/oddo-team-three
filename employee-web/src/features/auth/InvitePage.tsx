import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, IMAGES, Icon, Input, Skeleton } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { acceptInvitationSchema } from '@carpool/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/hooks';

/** Accepting an invitation activates the account immediately. */
export function InvitePage() {
  const { token = '' } = useParams();
  const { adopt } = useAuth();
  const navigate = useNavigate();
  const invitation = useApi(() => api.auth.previewInvitation(token), [token]);

  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    const parsed = acceptInvitationSchema.safeParse({ token, password, phone: phone || undefined });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await api.auth.acceptInvitation(parsed.data);
      adopt(result);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'Could not accept this invitation.');
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

          {invitation.initialLoading ? (
            <div className="stack" style={{ marginTop: 'var(--space-7)' }}>
              <Skeleton variant="title" width="70%" />
              <Skeleton width="50%" />
              <Skeleton variant="block" height={120} />
            </div>
          ) : invitation.error ? (
            <>
              <h1 className="auth__title">This invitation is not valid</h1>
              <p className="auth__lead">{invitation.error.message}</p>
              <div className="auth__form">
                <Alert tone="warning">
                  Ask your administrator to resend the invitation, or sign in if you already have an account.
                </Alert>
                <Link className="btn btn-primary btn-lg btn-block" to="/login">
                  Go to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth__title">Welcome to {invitation.data?.organizationName}</h1>
              <p className="auth__lead">
                {invitation.data?.name}, choose a password to activate your carpooling account.
              </p>

              <form className="auth__form" onSubmit={submit} noValidate>
                {failure ? <Alert tone="error">{failure}</Alert> : null}
                <Input label="Work email" value={invitation.data?.email ?? ''} disabled icon="mail" />
                <Input
                  label="Choose a password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  error={errors.password}
                  hint="At least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                />
                <Input
                  label="Phone"
                  optional
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  error={errors.phone}
                  hint="Shared only with colleagues whose seat you accept"
                />
                <Button type="submit" variant="primary" size="lg" loading={busy} block>
                  Activate my account
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <div className="auth__aside">
        <img src={IMAGES.passengers} alt="" />
        <div className="auth__aside-content">
          <p className="auth__aside-quote">Your first shared ride is one accepted seat away.</p>
        </div>
      </div>
    </div>
  );
}
