import { useState } from 'react';
import { View } from 'react-native';
import { updateProfileSchema } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { Alert, Button, Field, PageTitle, Screen } from '../components/ui';
import { api } from '../services/api';
import { useAuth } from '../store/auth';

/**
 * Profile completion. The navigator keeps this mounted until the profile is
 * complete, so the flow cannot be skipped by starting on the phone.
 */
export function ProfileSetupScreen() {
  const { user, refresh, signOut } = useAuth();
  const [form, setForm] = useState({ phone: '', homeLocation: '', workLocation: '', department: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
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

  return (
    <Screen>
      <PageTitle
        title={`Two more things, ${user?.name.split(' ')[0] ?? 'there'}.`}
        lead="Colleagues need to know where to pick you up, and how to reach you once a seat is confirmed."
      />

      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      {user?.status === 'pending' ? (
        <Alert tone="warning">
          Your account is pending activation. You can complete your profile now — publishing and requesting
          rides unlocks as soon as an administrator activates you.
        </Alert>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={set('phone')}
          error={errors.phone}
          keyboardType="phone-pad"
          hint="Only shared with colleagues on a confirmed ride"
        />
        <Field
          label="Where do you start from?"
          value={form.homeLocation}
          onChangeText={set('homeLocation')}
          error={errors.homeLocation}
          placeholder="Salt Lake Sector V"
        />
        <Field
          label="Where do you commute to?"
          value={form.workLocation}
          onChangeText={set('workLocation')}
          error={errors.workLocation}
          placeholder="Park Street Office"
        />
        <Field label="Department" value={form.department} onChangeText={set('department')} error={errors.department} />
        <Button title="Finish and continue" variant="primary" loading={busy} onPress={submit} />
        <Button title="Use a different account" variant="ghost" onPress={signOut} style={{ marginTop: 8 }} />
      </View>
    </Screen>
  );
}
