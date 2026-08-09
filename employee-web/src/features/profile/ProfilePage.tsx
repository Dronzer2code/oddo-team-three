import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { changePasswordSchema, updateProfileSchema } from '@carpool/shared';
import {
  AccountStatusBadge,
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  ErrorState,
  Icon,
  Input,
  PageHeader,
  Skeleton,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api, config } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';

/** Sectioned settings: account, preferences, vehicle, app, privacy, actions. */
export function ProfilePage() {
  const toast = useToast();
  const { refresh, signOut } = useAuth();
  const profile = useApi(() => api.employee.profile.get(), []);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    department: '',
    employeeCode: '',
    homeLocation: '',
    workLocation: '',
  });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation((body: Record<string, unknown>) => api.employee.profile.update(body));
  const changePassword = useMutation((body: { currentPassword: string; newPassword: string }) =>
    api.auth.changePassword(body),
  );

  useEffect(() => {
    const data = profile.data;
    if (!data) return;
    setForm({
      name: data.name,
      phone: data.phone ?? '',
      department: data.department ?? '',
      employeeCode: data.employeeCode ?? '',
      homeLocation: data.homeLocation ?? '',
      workLocation: data.workLocation ?? '',
    });
  }, [profile.data]);

  if (profile.error) {
    return (
      <>
        <PageHeader title="Profile" />
        <Card>
          <ErrorState {...resolveErrorCopy(profile.error)} onRetry={profile.reload} />
        </Card>
      </>
    );
  }

  if (profile.initialLoading || !profile.data) {
    return (
      <>
        <PageHeader title="Profile" />
        <Card>
          <CardBody className="stack">
            <Skeleton variant="title" width="35%" />
            <Skeleton width="55%" />
            <Skeleton variant="block" height={160} />
          </CardBody>
        </Card>
      </>
    );
  }

  const data = profile.data;

  async function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const parsed = updateProfileSchema.safeParse({
      name: form.name,
      phone: form.phone || undefined,
      department: form.department || undefined,
      employeeCode: form.employeeCode || undefined,
      homeLocation: form.homeLocation || undefined,
      workLocation: form.workLocation || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    const result = await save.run(parsed.data);
    if (result) {
      toast.success('Profile updated');
      await refresh();
      profile.reload();
    }
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (passwords.next !== passwords.confirm) {
      setErrors({ confirm: 'The two passwords do not match' });
      return;
    }
    const parsed = changePasswordSchema.safeParse({
      currentPassword: passwords.current,
      newPassword: passwords.next,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    const result = await changePassword.run(parsed.data);
    if (result) {
      toast.success('Password updated');
      setPasswords({ current: '', next: '', confirm: '' });
    }
  }

  return (
    <>
      <PageHeader
        title="Profile and settings"
        lead={`${data.organizationName} · ${data.email}`}
        actions={<AccountStatusBadge status={data.status} />}
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Account" lead="Your name and how colleagues reach you" />
            <CardBody>
              <form className="stack" onSubmit={submitProfile} noValidate>
                {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
                <Input
                  label="Full name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  error={errors.name ?? save.error?.fieldErrors.name}
                />
                <div className="form-row">
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    error={errors.phone ?? save.error?.fieldErrors.phone}
                    hint="Shared only after a seat is confirmed"
                  />
                  <Input
                    label="Employee ID"
                    optional
                    value={form.employeeCode}
                    onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
                    error={errors.employeeCode ?? save.error?.fieldErrors.employeeCode}
                  />
                </div>
                <Input
                  label="Department"
                  optional
                  value={form.department}
                  onChange={(event) => setForm({ ...form, department: event.target.value })}
                  error={errors.department ?? save.error?.fieldErrors.department}
                />

                <div className="road-rule" />
                <span className="t-label">Default commute</span>
                <div className="form-row">
                  <Input
                    label="Start from"
                    value={form.homeLocation}
                    onChange={(event) => setForm({ ...form, homeLocation: event.target.value })}
                    error={errors.homeLocation}
                    icon="pin"
                  />
                  <Input
                    label="Commute to"
                    value={form.workLocation}
                    onChange={(event) => setForm({ ...form, workLocation: event.target.value })}
                    error={errors.workLocation}
                    icon="pin"
                  />
                </div>
                <p className="t-caption">These prefill the publish-a-ride form.</p>

                <Button type="submit" variant="primary" loading={save.busy}>
                  Save profile
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Security" />
            <CardBody>
              <form className="stack" onSubmit={submitPassword} noValidate>
                {changePassword.error ? <Alert tone="error">{changePassword.error.message}</Alert> : null}
                <Input
                  label="Current password"
                  type="password"
                  value={passwords.current}
                  onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                  error={errors.currentPassword ?? changePassword.error?.fieldErrors.currentPassword}
                  autoComplete="current-password"
                />
                <div className="form-row">
                  <Input
                    label="New password"
                    type="password"
                    value={passwords.next}
                    onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                    error={errors.newPassword}
                    hint="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                    error={errors.confirm}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" variant="secondary" loading={changePassword.busy}>
                  Update password
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Organization" />
            <CardBody>
              <DetailList
                items={[
                  { label: 'Organization', value: data.organizationName },
                  { label: 'Account status', value: <AccountStatusBadge status={data.status} /> },
                  { label: 'Currency', value: data.currency },
                  { label: 'Distance unit', value: data.distanceUnit === 'km' ? 'Kilometres' : 'Miles' },
                ]}
              />
              <p className="t-caption" style={{ marginTop: 'var(--space-4)' }}>
                Currency and distance unit are set by your administrator for the whole organization.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle" />
            <CardBody className="stack">
              <p className="t-caption">Register or retire the car you drive to work.</p>
              <Link className="btn btn-secondary" to="/driver/vehicle">
                <Icon name="car" size={16} />
                My vehicles
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Privacy" />
            <CardBody className="stack">
              <p className="t-caption">
                Colleagues in {data.organizationName} can see your name, department and the vehicle on a ride
                you publish. Your phone number is only shared once a seat is confirmed.
              </p>
              <a
                className="btn btn-secondary"
                href={`${config.webUrl}#safety`}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="shield" size={16} />
                How we handle your data
                <Icon name="external" size={13} />
              </a>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account actions" />
            <CardBody className="stack">
              <Button variant="danger-outline" icon="logout" onClick={signOut}>
                Sign out
              </Button>
              <p className="t-caption">
                To deactivate your account, ask your administrator. Your trips and payments are preserved for
                the company&apos;s records.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
