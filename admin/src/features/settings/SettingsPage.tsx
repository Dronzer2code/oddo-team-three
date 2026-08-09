import { useState } from 'react';
import { Link } from 'react-router-dom';
import { changePasswordSchema } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  Icon,
  Input,
  PageHeader,
  useToast,
} from '@carpool/ui';
import { api, config } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useMutation } from '../../lib/hooks';

/**
 * Admin's own account. Organization-wide configuration lives on the
 * Organization and Costs pages — this page is deliberately small.
 */
export function SettingsPage() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const change = useMutation((body: { currentPassword: string; newPassword: string }) =>
    api.auth.changePassword(body),
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: 'The two passwords do not match' });
      return;
    }
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    const result = await change.run(parsed.data);
    if (result) {
      toast.success('Password updated — the change is recorded in the audit log');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  return (
    <>
      <PageHeader title="Admin settings" lead="Your own administrator account." />

      <div className="grid grid-even" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Account" />
            <CardBody>
              <DetailList
                items={[
                  { label: 'Name', value: user?.name ?? '—' },
                  { label: 'Email', value: user?.email ?? '—' },
                  { label: 'Role', value: 'Company administrator' },
                  { label: 'Organization', value: user?.organizationName ?? '—' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Security" lead="Changing your password is audited" />
            <CardBody>
              <form className="stack" onSubmit={submit} noValidate>
                {change.error ? <Alert tone="error">{change.error.message}</Alert> : null}
                <Input
                  label="Current password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  error={errors.currentPassword ?? change.error?.fieldErrors.currentPassword}
                  autoComplete="current-password"
                />
                <Input
                  label="New password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  error={errors.newPassword}
                  hint="At least 8 characters"
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                />
                <Button type="submit" variant="primary" loading={change.busy}>
                  Update password
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Organization configuration" />
            <CardBody className="stack">
              <p className="t-caption">
                Organization-wide settings are separated from your personal account so they can be audited
                independently.
              </p>
              <Link className="btn btn-secondary" to="/admin/organization">
                <Icon name="building" size={16} />
                Organization identity and policy
              </Link>
              <Link className="btn btn-secondary" to="/admin/costs">
                <Icon name="fuel" size={16} />
                Fuel and travel cost versions
              </Link>
              <Link className="btn btn-secondary" to="/admin/audit-logs">
                <Icon name="history" size={16} />
                Audit logs
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Applications" />
            <CardBody className="stack">
              <a className="btn btn-secondary" href={config.employeeUrl} target="_blank" rel="noreferrer">
                <Icon name="car" size={16} />
                Employee web application
                <Icon name="external" size={13} />
              </a>
              <a className="btn btn-secondary" href={config.webUrl} target="_blank" rel="noreferrer">
                <Icon name="external" size={16} />
                Public website
              </a>
              <p className="t-caption">API endpoint: {config.apiUrl}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Session" />
            <CardBody className="stack">
              <p className="t-caption">
                Signing out clears the session on this device. Administrators cannot publish or book rides on
                behalf of employees.
              </p>
              <Button variant="danger-outline" icon="logout" onClick={signOut}>
                Sign out
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
