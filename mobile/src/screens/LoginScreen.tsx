import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { loginSchema } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import { Alert, Button, Card, Field, PageTitle, Screen, styles } from '../components/ui';
import { colors, space } from '../theme/tokens';
import { useAuth } from '../store/auth';

const DEMO_ACCOUNTS = [
  { role: 'Driver', email: 'ananya.bose@example.com' },
  { role: 'Passenger', email: 'meera.iyer@example.com' },
  { role: 'Suspended', email: 'imran.sheikh@example.com' },
];

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFailure(null);
    // The same schema the API validates against — no second set of rules.
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
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
    } catch (error) {
      setFailure(
        error instanceof ApiError
          ? error.isNetworkError
            ? 'Cannot reach the API. Check that the backend is running and reachable from this device.'
            : error.message
          : 'Sign in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <PageTitle title="Where are you going today?" lead="Sign in with your work email." />

      {failure ? <Alert tone="danger">{failure}</Alert> : null}

      <View style={{ marginTop: space[4] }}>
        <Field
          label="Work email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@company.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          placeholder="Your password"
        />
        <Button title="Sign in" variant="primary" loading={busy} onPress={submit} />
      </View>

      <Card style={{ marginTop: space[6], backgroundColor: colors.accentFaint }}>
        <Text style={styles.label}>DEMO ACCOUNTS — PASSWORD PASSWORD123!</Text>
        <View style={{ gap: space[2], marginTop: space[3] }}>
          {DEMO_ACCOUNTS.map((account) => (
            <Pressable
              key={account.email}
              onPress={() => {
                setEmail(account.email);
                setPassword('Password123!');
              }}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                backgroundColor: colors.surface,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={[styles.caption, { fontWeight: '500', color: colors.fg }]}>{account.role}</Text>
              <Text style={styles.caption} numberOfLines={1}>
                {account.email}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
