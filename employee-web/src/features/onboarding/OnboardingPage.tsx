import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCOUNT_STATUS, updateProfileSchema } from '@carpool/shared';
import { Alert, AuthLayout, Button, Card, CardBody, IMAGES, Input, useToast } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

/**
 * Profile completion. Short and specific: we need a phone number and the two
 * places the employee actually travels between.
 */
export function OnboardingPage() {
  const { user, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    phone: '',
    homeLocation: '',
    workLocation: '',
    department: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    const parsed = updateProfileSchema.safeParse({
      phone: form.phone,
      homeLocation: form.homeLocation,
      workLocation: form.workLocation,
      department: form.department || undefined,
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
      await api.employee.profile.update(parsed.data);
      await refresh();
      toast.success('Profile complete');
      navigate('/home', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('Could not save your profile. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const pending = user?.status === ACCOUNT_STATUS.PENDING;

  return (
    <AuthLayout
      eyebrow="Profile"
      title={`Two more things, ${user?.name.split(' ')[0] ?? 'there'}.`}
      lead="Colleagues need to know where to pick you up, and how to reach you once a seat is confirmed."
      claim="Home to office, shared."
      claimText="Your pickup point and department help colleagues on the same route recognise you. Your phone number is only shared once a seat is confirmed."
      photo={IMAGES.roadAerial}
    >
      <form className="auth__form" onSubmit={submit} noValidate>
        {failure ? <Alert tone="error">{failure}</Alert> : null}
        {pending ? (
          <Alert tone="warning">
            Your account is pending activation by an administrator. You can complete your profile now —
            publishing and requesting rides unlocks as soon as they activate you.
          </Alert>
        ) : null}

        <Input
          label="Phone"
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone}
          hint="Only shared with colleagues on a confirmed ride"
          autoFocus
        />
        <Input
          label="Where do you start from?"
          value={form.homeLocation}
          onChange={set('homeLocation')}
          error={errors.homeLocation}
          placeholder="Salt Lake Sector V"
          icon="pin"
        />
        <Input
          label="Where do you commute to?"
          value={form.workLocation}
          onChange={set('workLocation')}
          error={errors.workLocation}
          placeholder="Park Street Office"
          icon="pin"
        />
        <Input
          label="Department"
          optional
          value={form.department}
          onChange={set('department')}
          error={errors.department}
        />

        <Button type="submit" variant="primary" size="lg" loading={busy} block>
          Finish and continue
        </Button>
      </form>

      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardBody tight>
          <p className="t-caption">
            Signed in as {user?.email}.{' '}
            <button className="btn-link" onClick={signOut}>
              Use a different account
            </button>
          </p>
        </CardBody>
      </Card>
    </AuthLayout>
  );
}
