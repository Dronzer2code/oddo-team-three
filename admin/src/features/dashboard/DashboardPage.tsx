import { Link } from 'react-router-dom';
import {
  AUDIT_ACTION_LABEL,
  formatDistance,
  formatMoney,
  formatNumber,
  formatRelative,
} from '@carpool/shared';
import {
  BarChart,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChartLegend,
  EmptyState,
  ErrorState,
  Icon,
  Meter,
  PageHeader,
  Skeleton,
  SkeletonStats,
  Stat,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';

export function DashboardPage() {
  const { user } = useAuth();

  // Three independent requests: a slow trend never blocks the headline metrics.
  const summary = useApi(() => api.admin.dashboard.summary(), []);
  const trend = useApi(() => api.admin.dashboard.trend(), []);
  const activity = useApi(() => api.admin.dashboard.activity(), []);

  const data = summary.data;

  return (
    <>
      <PageHeader
        title={`${user?.organizationName ?? 'Organization'} overview`}
        lead="Live counts from rides, trips and cost configuration — nothing on this page is hardcoded."
        actions={
          <>
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => {
                summary.reload();
                trend.reload();
                activity.reload();
              }}
            >
              Refresh
            </Button>
            <Link className="btn btn-primary" to="/reports">
              <Icon name="list" size={16} />
              Open reports
            </Link>
          </>
        }
      />

      {summary.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(summary.error)} onRetry={summary.reload} />
        </Card>
      ) : summary.initialLoading || !data ? (
        <SkeletonStats count={4} />
      ) : (
        <>
          <div className="grid grid-4">
            <Stat
              label="Active employees"
              value={formatNumber(data.employees.active)}
              icon="users"
              foot={
                <>
                  <span>{formatNumber(data.employees.total)} on the platform</span>
                  {data.employees.newThisMonth > 0 ? (
                    <span className="trend trend--up">
                      <Icon name="arrowUp" size={12} />
                      {data.employees.newThisMonth} this month
                    </span>
                  ) : null}
                </>
              }
            />
            <Stat
              label="Vehicles"
              value={formatNumber(data.vehicles.total)}
              icon="car"
              foot={
                <>
                  <span>{formatNumber(data.vehicles.active)} active</span>
                  {data.vehicles.underReview > 0 ? (
                    <Link to="/vehicles?status=under_review" className="t-medium">
                      {data.vehicles.underReview} awaiting review
                    </Link>
                  ) : null}
                </>
              }
            />
            <Stat
              label="Completed trips"
              value={formatNumber(data.trips.completed)}
              icon="route"
              accent
              foot={<span>{formatNumber(data.trips.completedThisMonth)} this month</span>}
            />
            <Stat
              label="Total distance"
              value={formatDistance(data.distance.totalKm)}
              icon="trend"
              foot={<span>{formatDistance(data.distance.thisMonthKm)} this month</span>}
            />
          </div>

          <div className="grid grid-3" style={{ marginTop: 'var(--space-4)' }}>
            <Stat
              label="Estimated fuel"
              value={`${formatNumber(data.fuel.litres, 1)} L`}
              icon="fuel"
              small
              foot={<span>Across every completed trip</span>}
            />
            <Stat
              label="Transportation cost"
              value={formatMoney(data.cost.total, data.cost.currency)}
              icon="wallet"
              small
              foot={<span>{formatMoney(data.cost.perKm, data.cost.currency, 2)} per km</span>}
            />
            <Stat
              label="Rides published"
              value={formatNumber(data.rides.total)}
              icon="list"
              small
              foot={
                <>
                  <span>{formatNumber(data.rides.published)} open</span>
                  <span className="t-muted">{formatNumber(data.rides.canceled)} canceled</span>
                </>
              }
            />
          </div>

          <div className="grid grid-split" style={{ marginTop: 'var(--space-6)' }}>
            <Card>
              <CardHeader
                title="Completed trips by month"
                lead="Last six months"
                actions={<ChartLegend keys={[{ label: 'Trips' }, { label: 'This month', tone: 'accent' }]} />}
              />
              <CardBody>
                {trend.error ? (
                  <ErrorState {...resolveErrorCopy(trend.error)} onRetry={trend.reload} />
                ) : trend.initialLoading ? (
                  <Skeleton variant="block" height={168} />
                ) : (trend.data ?? []).every((point) => point.trips === 0) ? (
                  <EmptyState
                    icon="chart"
                    title="No completed trips yet"
                    text="Trip metrics appear here as soon as employees start completing rides."
                  />
                ) : (
                  <BarChart
                    points={(trend.data ?? []).map((point) => ({ label: point.label, value: point.trips }))}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Participation" lead="Last 30 days" />
              <CardBody className="stack-lg">
                <div>
                  <div className="t-metric">{formatNumber(data.participation.participationRate, 1)}%</div>
                  <p className="t-caption">
                    {formatNumber(data.participation.activeParticipants)} of{' '}
                    {formatNumber(data.employees.total)} employees published, requested or completed a ride.
                  </p>
                </div>
                <Meter value={data.participation.participationRate} accent />
                <div className="stack-sm">
                  <div className="row-between t-caption">
                    <span>Pending activation</span>
                    <span className="t-medium">{formatNumber(data.employees.pending)}</span>
                  </div>
                  <div className="row-between t-caption">
                    <span>Suspended</span>
                    <span className="t-medium">{formatNumber(data.employees.suspended)}</span>
                  </div>
                  <div className="row-between t-caption">
                    <span>Trips in progress</span>
                    <span className="t-medium">{formatNumber(data.trips.inProgress)}</span>
                  </div>
                </div>
                <Link className="btn btn-secondary btn-sm" to="/participation">
                  Participation detail
                  <Icon name="arrowRight" size={14} />
                </Link>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Card style={{ marginTop: 'var(--space-6)' }}>
        <CardHeader
          title="Recent administrative activity"
          actions={
            <Link className="btn btn-ghost btn-sm" to="/audit-logs">
              All audit logs
              <Icon name="arrowRight" size={14} />
            </Link>
          }
        />
        <CardBody flush>
          {activity.error ? (
            <ErrorState {...resolveErrorCopy(activity.error)} onRetry={activity.reload} />
          ) : activity.initialLoading ? (
            <div className="card-body stack">
              <Skeleton width="60%" />
              <Skeleton width="45%" />
              <Skeleton width="52%" />
            </div>
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState
              icon="history"
              title="No administrative activity yet"
              text="Access changes, vehicle decisions and configuration edits appear here."
            />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {(activity.data ?? []).map((entry) => (
                    <tr key={entry.id}>
                      <td style={{ width: 40 }}>
                        <span className="card-statistic__icon">
                          <Icon
                            name={
                              entry.entityType === 'vehicle'
                                ? 'car'
                                : entry.entityType === 'employee'
                                  ? 'users'
                                  : 'settings'
                            }
                            size={14}
                          />
                        </span>
                      </td>
                      <td>
                        <div className="t-medium">{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</div>
                        <div className="t-caption">by {entry.actorName}</div>
                      </td>
                      <td className="t-caption t-nowrap t-right">{formatRelative(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
