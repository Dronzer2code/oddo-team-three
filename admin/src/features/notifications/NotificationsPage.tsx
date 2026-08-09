import { Link } from 'react-router-dom';
import { AUDIT_ACTION_LABEL, formatDateTime, formatRelative } from '@carpool/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SkeletonCards,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/**
 * Decisions the administrator still owes, then recent activity. The feed is
 * derived from the records themselves rather than a stored notification table,
 * so it can never drift from what the other tabs show.
 */
export function NotificationsPage() {
  const feed = useApi(() => api.admin.notifications(), []);
  const items = feed.data ?? [];
  const actionable = items.filter((item) => item.requiresAction);
  const activity = items.filter((item) => !item.requiresAction);

  return (
    <>
      <PageHeader
        title="Notifications"
        lead="Approvals waiting on you, followed by everything that changed recently."
        actions={
          <Button variant="secondary" icon="refresh" onClick={feed.reload} loading={feed.loading}>
            Refresh
          </Button>
        }
      />

      {feed.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(feed.error)} onRetry={feed.reload} />
        </Card>
      ) : feed.initialLoading ? (
        <SkeletonCards count={2} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="bell"
            title="Nothing needs your attention"
            text="Approvals and organization activity will appear here."
          />
        </Card>
      ) : (
        <div className="stack-lg">
          <Card>
            <CardHeader
              title="Needs a decision"
              lead={
                actionable.length === 0
                  ? 'Your approval queues are clear.'
                  : `${actionable.length} item${actionable.length === 1 ? '' : 's'} waiting`
              }
            />
            <CardBody flush>
              {actionable.length === 0 ? (
                <EmptyState icon="check" title="Nothing waiting" text="Every approval queue is empty." />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {actionable.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="row" style={{ gap: 'var(--space-3)' }}>
                              <span className="card-statistic__icon card-statistic__icon--accent">
                                <Icon name="alert" size={15} />
                              </span>
                              <span>
                                <div className="t-medium">{item.title}</div>
                                <div className="t-caption">{item.body}</div>
                              </span>
                            </div>
                          </td>
                          <td className="t-caption t-nowrap t-right">{formatRelative(item.createdAt)}</td>
                          <td>
                            {item.href ? (
                              <Link className="btn btn-primary btn-sm" to={item.href}>
                                Review
                                <Icon name="arrowRight" size={13} />
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent activity" lead="The last changes recorded in your organization." />
            <CardBody flush>
              {activity.length === 0 ? (
                <EmptyState icon="history" title="No recent activity" />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {activity.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="t-medium">{AUDIT_ACTION_LABEL[item.title] ?? item.title}</div>
                            <div className="t-caption">{item.body}</div>
                          </td>
                          <td className="t-caption t-nowrap t-right">
                            {formatDateTime(item.createdAt)}
                            <div>{formatRelative(item.createdAt)}</div>
                          </td>
                          <td>
                            {item.href ? (
                              <Link className="btn btn-ghost btn-sm" to={item.href}>
                                Open
                                <Icon name="arrowRight" size={13} />
                              </Link>
                            ) : (
                              <Badge>—</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
