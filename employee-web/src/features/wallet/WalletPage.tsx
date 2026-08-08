import { Link } from 'react-router-dom';
import { formatDate, formatMoney } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  PaymentStatusBadge,
  SkeletonStats,
  Stat,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

/**
 * Cost sharing between colleagues. Deliberately a ledger, not a payment
 * processor — settlement happens between people, the driver confirms it.
 */
export function WalletPage() {
  const toast = useToast();
  const wallet = useApi(() => api.employee.payments.wallet(), []);
  const settle = useMutation((id: string) => api.employee.payments.settle(id));

  const data = wallet.data;

  return (
    <>
      <PageHeader
        title="Wallet"
        lead="What you owe colleagues for seats, and what passengers owe you for driving."
      />

      {wallet.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(wallet.error)} onRetry={wallet.reload} />
        </Card>
      ) : wallet.initialLoading || !data ? (
        <SkeletonStats count={4} />
      ) : (
        <>
          <div className="grid grid-4">
            <Stat
              label="You owe"
              value={formatMoney(data.owed, data.currency)}
              icon="wallet"
              small
              foot={<span>pending seats you took</span>}
            />
            <Stat
              label="Owed to you"
              value={formatMoney(data.receivable, data.currency)}
              icon="users"
              accent
              small
              foot={<span>pending seats you drove</span>}
            />
            <Stat
              label="Net position"
              value={formatMoney(data.net, data.currency)}
              icon="trend"
              small
              foot={<span>{data.net >= 0 ? 'in your favour' : 'you are behind'}</span>}
            />
            <Stat
              label="Settled to date"
              value={formatMoney(data.settledIn + data.settledOut, data.currency)}
              icon="check"
              small
              foot={<span>across all trips</span>}
            />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            <CardHeader
              title="Ledger"
              lead="Each line is one passenger's share of one completed trip"
              actions={
                <Button variant="ghost" size="sm" icon="refresh" onClick={wallet.reload}>
                  Refresh
                </Button>
              }
            />
            <CardBody flush>
              {data.payments.length === 0 ? (
                <EmptyState
                  icon="wallet"
                  title="Nothing to settle yet"
                  text="Once you complete a shared trip, the cost split appears here."
                  action={
                    <Link className="btn btn-primary" to="/rides">
                      Find a ride
                    </Link>
                  }
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Direction</th>
                        <th>Status</th>
                        <th className="is-numeric">Amount</th>
                        <th>Date</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <Link to={`/trips/${payment.tripId}`} className="t-medium">
                              {payment.route}
                            </Link>
                          </td>
                          <td className="t-caption">
                            {payment.direction === 'outgoing' ? (
                              <span className="row" style={{ gap: 6 }}>
                                <Icon name="arrowRight" size={13} />
                                to {payment.receiverName}
                              </span>
                            ) : (
                              <span className="row" style={{ gap: 6 }}>
                                <Icon name="arrowLeft" size={13} />
                                from {payment.payerName}
                              </span>
                            )}
                          </td>
                          <td>
                            <PaymentStatusBadge status={payment.status} />
                          </td>
                          <td className="is-numeric t-medium">
                            {formatMoney(payment.amount, payment.currency)}
                          </td>
                          <td className="t-caption t-nowrap">
                            {formatDate(payment.paidAt ?? payment.createdAt)}
                          </td>
                          <td>
                            <div className="table__actions">
                              {payment.status === 'pending' && payment.direction === 'incoming' ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={settle.busy}
                                  onClick={async () => {
                                    const result = await settle.run(payment.id);
                                    if (result) {
                                      toast.success('Marked as settled');
                                      wallet.reload();
                                    } else if (settle.error) {
                                      toast.error(settle.error.message);
                                    }
                                  }}
                                >
                                  Mark settled
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Alert tone="info" className="animate-in">
            RideSync does not move money. Settle between yourselves however you normally do — the driver
            confirms it here so the ledger stays honest.
          </Alert>
        </>
      )}
    </>
  );
}
