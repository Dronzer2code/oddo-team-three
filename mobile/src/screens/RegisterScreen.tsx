import { useState } from 'react';
import { View } from 'react-native';
import { registerSchema } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { Alert, Button, Field, PageTitle, Screen } from '../components/ui';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

/**
 * Organisation-controlled registration: the code identifies the organisation,
 * and the account is created as pending until an administrator activates it.
 */
export function RegisterScreen() {
  const { adopt } = useAuth();
  const [form, setForm] = useState({
    organizationSlug: 'northwind-logistics',
    name: '',
    email: '',
    password: '',
    phone: '',
    department: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setFailure(null);
    const parsed = registerSchema.safeParse({
      ...form,
      email: form.email.trim(),
      phone: form.phone || undefined,
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
      await adopt(await api.auth.register(parsed.data));
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
    <Screen>
      <PageTitle
        title="Join your organisation"
        lead="Your account starts as pending until an administrator activates carpooling access."
      />

      {failure ? <Alert tone="danger">{failure}</Alert> : null}

      <View style={{ marginTop: 16 }}>
        <Field
          label="Organisation code"
          value={form.organizationSlug}
          onChangeText={set('organizationSlug')}
          error={errors.organizationSlug}
          autoCapitalize="none"
          hint="For the demo organisation: northwind-logistics"
        />
        <Field label="Full name" value={form.name} onChangeText={set('name')} error={errors.name} />
        <Field
          label="Work email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          secureTextEntry
          hint="At least 8 characters"
        />
        <Field label="Phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
        <Field label="Department" value={form.department} onChangeText={set('department')} error={errors.department} />
        <Button title="Create account" variant="primary" loading={busy} onPress={submit} />
      </View>
    </Screen>
  );
}
