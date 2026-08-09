import { Link } from 'react-router-dom';
import { formatDateTime, formatRelative, type NotificationItem } from '@carpool/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SkeletonTable,
  resolveErrorCopy,
} from '@carpool/ui';
import type { AsyncState } from '../lib/hooks';

/**
 * Both panels render the same feed shape, so the list lives here once. The
 * items are derived server-side from the records themselves — requests,
 * decisions, trips, vehicle approvals — so this can never disagree with what
 * the other tabs show.
 */
export function NotificationFeed({
  feed,
  lead,
  emptyText,
}: {
  feed: AsyncState<NotificationItem[]>;
  lead: string;
  emptyText: string;
}) {
  const items = feed.data ?? [];
  const actionable = items.filter((item) => item.requiresAction);

  return (
    <>
      <PageHeader
        title="Notifications"
        lead={lead}
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
        <Card>
          <SkeletonTable rows={6} columns={3} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon="bell" title="Nothing new" text={emptyText} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Recent"
            lead={
              actionable.length > 0
                ? `${actionable.length} item${actionable.length === 1 ? '' : 's'} need your attention`
                : 'Nothing needs your attention right now'
            }
          />
          <CardBody flush>
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="row" style={{ gap: 'var(--space-3)' }}>
                          <span
                            className={
                              item.requiresAction
                                ? 'card-statistic__icon card-statistic__icon--accent'
                                : 'card-statistic__icon'
                            }
                          >
                            <Icon name={item.requiresAction ? 'alert' : 'bell'} size={15} />
                          </span>
                          <span>
                            <div className="t-medium">{item.title}</div>
                            <div className="t-caption">{item.body}</div>
                          </span>
                        </div>
                      </td>
                      <td className="t-caption t-right t-nowrap">
                        {formatRelative(item.createdAt)}
                        <div>{formatDateTime(item.createdAt)}</div>
                      </td>
                      <td>
                        {item.href ? (
                          <Link
                            className={item.requiresAction ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                            to={item.href}
                          >
                            Open
                            <Icon name="arrowRight" size={13} />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}
