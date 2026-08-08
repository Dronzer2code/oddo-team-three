import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, AuthLayout, Button, IMAGES, Input, Skeleton } from '@carpool/ui';
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

    const parsed = acceptInvitationSchema.safeParse({
      token,
      password,
      phone: phone || undefined,
    });
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

  // The heading changes with the invitation's state, so it is resolved before
  // the shell renders rather than repeated inside each branch.
  const title = invitation.initialLoading
    ? 'Checking your invitation'
    : invitation.error
      ? 'This invitation is not valid'
      : `Welcome to ${invitation.data?.organizationName ?? 'your organisation'}`;
  const lead = invitation.initialLoading
    ? 'One moment while we look it up.'
    : invitation.error
      ? invitation.error.message
      : `${invitation.data?.name}, choose a password to activate your carpooling account.`;

  return (
    <AuthLayout
      eyebrow="Invitation"
      title={title}
      lead={lead}
      claim="Your first shared ride is one accepted seat away."
      claimText="You were invited by your organisation, so the account is already attached to it. Setting a password activates carpooling access immediately."
      photo={IMAGES.passengers}
      footer={
        <span>
          Not expecting this? <Link to="/login">Sign in instead</Link>
        </span>
      }
    >
      {invitation.initialLoading ? (
        <div className="stack" style={{ marginTop: 'var(--space-7)' }}>
          <Skeleton variant="block" height={120} />
          <Skeleton width="50%" />
        </div>
      ) : invitation.error ? (
        <div className="auth__form">
          <Alert tone="warning">
            Ask your administrator to resend the invitation, or sign in if you already have an account.
          </Alert>
          <Link className="btn btn-primary btn-lg btn-block" to="/login">
            Go to sign in
          </Link>
        </div>
      ) : (
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
      )}
    </AuthLayout>
  );
}
