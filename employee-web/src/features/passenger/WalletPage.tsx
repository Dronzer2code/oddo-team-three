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
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/**
 * Trip costs for a passenger. The page is called "Wallet" only when payment
 * records actually exist — otherwise it is "Trip Costs", because a wallet with
 * no transactions behind it would be a fiction. Nothing here is a balance the
 * platform holds; every figure is the sum of persisted trip shares.
 */
export function PassengerWalletPage() {
  const wallet = useApi(() => api.employee.payments.wallet(), []);
  const data = wallet.data;

  // Only what this employee owes as a passenger belongs on this page.
  const outgoing = (data?.payments ?? []).filter((payment) => payment.direction === 'outgoing');
  const settled = outgoing.filter((payment) => payment.status === 'settled');
  const pending = outgoing.filter((payment) => payment.status === 'pending');

  const totalCompleted = outgoing.reduce((sum, payment) => sum + payment.amount, 0);
  const pendingCost = pending.reduce((sum, payment) => sum + payment.amount, 0);

  // "Current period" is the calendar month — the window the reports use.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const currentPeriod = outgoing
    .filter((payment) => new Date(payment.createdAt).getTime() >= monthStart.getTime())
    .reduce((sum, payment) => sum + payment.amount, 0);

  const hasPayments = outgoing.length > 0;
  const title = hasPayments ? 'Wallet' : 'Trip Costs';

  return (
    <>
      <PageHeader
        title={title}
        lead="What your completed trips have cost you, taken from the recorded cost split."
      />

      {wallet.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(wallet.error)} onRetry={wallet.reload} />
        </Card>
      ) : wallet.initialLoading || !data ? (
        <SkeletonStats count={3} />
      ) : (
        <>
          <div className="grid grid-4">
            <Stat
              label="Total completed trip cost"
              value={formatMoney(totalCompleted, data.currency)}
              icon="wallet"
              accent
              small
              foot={<span>across {outgoing.length} trip{outgoing.length === 1 ? '' : 's'}</span>}
            />
            <Stat
              label="Current period cost"
              value={formatMoney(currentPeriod, data.currency)}
              icon="calendar"
              small
              foot={<span>this month</span>}
            />
            <Stat
              label="Pending cost"
              value={formatMoney(pendingCost, data.currency)}
              icon="clock"
              small
              foot={<span>{pending.length} not yet settled</span>}
            />
            <Stat
              label="Settled"
              value={formatMoney(
                settled.reduce((sum, payment) => sum + payment.amount, 0),
                data.currency,
              )}
              icon="check"
              small
              foot={<span>{settled.length} confirmed by drivers</span>}
            />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            <CardHeader
              title="Transaction history"
              lead="Each line is your share of one completed trip"
              actions={
                <Button variant="ghost" size="sm" icon="refresh" onClick={wallet.reload}>
                  Refresh
                </Button>
              }
            />
            <CardBody flush>
              {outgoing.length === 0 ? (
                <EmptyState
                  icon="wallet"
                  title="No trip costs yet"
                  text="Once a trip you were on completes, your share of the cost appears here."
                  action={
                    <Link className="btn btn-primary" to="/passenger/rides">
                      Find a Ride
                    </Link>
                  }
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Paid to</th>
                        <th>Status</th>
                        <th className="is-numeric">Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outgoing.map((payment) => (
                        <tr key={payment.id}>
                          <td className="t-medium">{payment.route}</td>
                          <td className="t-caption">
                            <span className="row" style={{ gap: 6 }}>
                              <Icon name="arrowRight" size={13} />
                              {payment.receiverName}
                            </span>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Alert tone="info" className="animate-in">
            RideSync does not move money. Settle with your driver however you normally do — they confirm
            it here so the ledger stays honest.
          </Alert>
        </>
      )}
    </>
  );
}
