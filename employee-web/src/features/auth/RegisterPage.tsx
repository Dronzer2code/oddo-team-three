import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AuthLayout, Button, IMAGES, Input } from '@carpool/ui';
import { ApiError } from '@carpool/api-client';
import { registerSchema } from '@carpool/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function RegisterPage() {
  const { adopt } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    organizationSlug: 'northwind-logistics',
    name: '',
    email: '',
    password: '',
    phone: '',
    employeeCode: '',
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

    const parsed = registerSchema.safeParse({
      ...form,
      phone: form.phone || undefined,
      employeeCode: form.employeeCode || undefined,
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
      const result = await api.auth.register(parsed.data);
      adopt(result);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFailure(error.message);
      } else {
        setFailure('Could not create your account. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="New account"
      title="Join your organisation."
      lead="Ask your administrator for your organisation code. Your account starts as pending until they activate carpooling access."
      claim="Your commute is somebody else's commute too."
      claimText="Accounts start pending. Your administrator activates carpooling access, and only then can you publish or request a seat — enforced in the API, not in the interface."
      photo={IMAGES.cityDriving}
      footer={
        <span>
          Already have an account? <Link to="/login">Sign in</Link>
        </span>
      }
    >
      <form className="auth__form" onSubmit={submit} noValidate>
        {failure ? <Alert tone="error">{failure}</Alert> : null}

        <Input
          label="Organization code"
          value={form.organizationSlug}
          onChange={set('organizationSlug')}
          error={errors.organizationSlug}
          hint="For the demo organization: northwind-logistics"
          icon="building"
        />
        <Input
          label="Full name"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          autoComplete="name"
        />
        <Input
          label="Work email"
          type="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters"
          autoComplete="new-password"
        />
        <div className="form-row">
          <Input label="Phone" optional value={form.phone} onChange={set('phone')} error={errors.phone} />
          <Input
            label="Department"
            optional
            value={form.department}
            onChange={set('department')}
            error={errors.department}
          />
        </div>
        <Button type="submit" variant="primary" size="lg" loading={busy} block>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
