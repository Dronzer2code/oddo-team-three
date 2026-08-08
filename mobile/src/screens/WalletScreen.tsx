import { Text, View } from 'react-native';
import { PAYMENT_STATUS_LABEL, formatDate, formatMoney } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Metric,
  PageTitle,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';

const TONE = { pending: 'warning', settled: 'success', waived: 'neutral' } as const;

/**
 * What the employee owes and is owed for completed trips. Settlement is a simple
 * mark-as-paid against the API — no payment processing in the MVP.
 */
export function WalletScreen() {
  const wallet = useApi(() => api.employee.payments.wallet(), []);
  const settle = useMutation((id: string) => api.employee.payments.settle(id));

  return (
    <Screen>
      <PageTitle
        title="Payments"
        lead="Shares of the fuel and running cost for trips you have completed."
      />

      {settle.error ? <Alert tone="danger">{settle.error.message}</Alert> : null}

      {wallet.initialLoading ? (
        <SkeletonList rows={3} />
      ) : wallet.error ? (
        <ErrorState message={wallet.error.message} onRetry={wallet.reload} />
      ) : wallet.data ? (
        <>
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Metric label="You owe" value={formatMoney(wallet.data.owed, wallet.data.currency)} />
            <Metric label="Owed to you" value={formatMoney(wallet.data.receivable, wallet.data.currency)} />
          </View>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Net position</Text>
              <Text style={styles.subtitle}>{formatMoney(wallet.data.net, wallet.data.currency)}</Text>
            </View>
            <Divider />
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Settled out</Text>
              <Text style={styles.body}>{formatMoney(wallet.data.settledOut, wallet.data.currency)}</Text>
            </View>
            <View style={[styles.rowBetween, { marginTop: space[2] }]}>
              <Text style={styles.caption}>Settled in</Text>
              <Text style={styles.body}>{formatMoney(wallet.data.settledIn, wallet.data.currency)}</Text>
            </View>
          </Card>

          <Text style={[styles.title, { marginTop: space[5] }]}>History</Text>
          {wallet.data.payments.length === 0 ? (
            <EmptyState
              title="Nothing to settle"
              text="Payment records appear once a trip you were on is completed."
            />
          ) : (
            wallet.data.payments.map((payment) => (
              <Card key={payment.id}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subtitle}>
                      {payment.direction === 'outgoing'
                        ? `To ${payment.receiverName}`
                        : `From ${payment.payerName}`}
                    </Text>
                    <Text style={styles.caption}>{formatDate(payment.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                    <Text style={styles.subtitle}>{formatMoney(payment.amount, payment.currency)}</Text>
                    <Badge tone={TONE[payment.status]}>{PAYMENT_STATUS_LABEL[payment.status]}</Badge>
                  </View>
                </View>
                {payment.status === 'pending' && payment.direction === 'outgoing' ? (
                  <Button
                    title="Mark as settled"
                    variant="secondary"
                    style={{ marginTop: space[4] }}
                    loading={settle.busy}
                    onPress={async () => {
                      if (await settle.run(payment.id)) wallet.reload();
                    }}
                  />
                ) : null}
              </Card>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
