import { Link } from 'react-router-dom';
import { formatRelative, formatTime } from '@carpool/shared';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  RequestStatusBadge,
  Skeleton,
  resolveErrorCopy,
  type IconName,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

interface ActivityItem {
  id: string;
  icon: IconName;
  title: string;
  detail: string;
  when: string;
  href: string;
  accent?: boolean;
}

/**
 * Activity is derived from real ride and trip state rather than a notification
 * table — there is no notification system in the MVP, so nothing here is fake.
 */
export function ActivityPage() {
  const incoming = useApi(() => api.employee.rides.incomingRequests(), []);
  const mine = useApi(() => api.employee.rides.mine(), []);
  const active = useApi(() => api.employee.trips.active(), []);

  const items: ActivityItem[] = [];

  if (active.data) {
    items.push({
      id: `trip-${active.data.id}`,
      icon: 'route',
      title: 'Trip in progress',
      detail: `${active.data.startLocation} → ${active.data.destination}`,
      when: active.data.startedAt,
      href: `/trips/${active.data.id}`,
      accent: true,
    });
  }

  for (const request of incoming.data ?? []) {
    items.push({
      id: `request-${request.id}`,
      icon: 'seat',
      title: `${request.passenger.name} requested ${request.seats} seat${request.seats === 1 ? '' : 's'}`,
      detail: request.note ? `“${request.note}”` : 'Waiting for your decision',
      when: request.createdAt,
      href: `/rides/${request.rideId}`,
      accent: true,
    });
  }

  for (const ride of mine.data?.riding ?? []) {
    items.push({
      id: `mine-${ride.id}`,
      icon: ride.viewer.requestStatus === 'accepted' ? 'check' : 'clock',
      title:
        ride.viewer.requestStatus === 'accepted'
          ? `Your seat with ${ride.driver.name} is confirmed`
          : `Waiting for ${ride.driver.name} to confirm your seat`,
      detail: `${ride.startLocation} → ${ride.destination} at ${formatTime(ride.departureAt)}`,
      when: ride.createdAt,
      href: `/rides/${ride.id}`,
    });
  }

  for (const ride of mine.data?.driving ?? []) {
    if (ride.status !== 'published' && ride.status !== 'full') continue;
    items.push({
      id: `driving-${ride.id}`,
      icon: 'car',
      title: `You are driving at ${formatTime(ride.departureAt)}`,
      detail: `${ride.seatsAvailable} of ${ride.totalSeats} seats still free`,
      when: ride.departureAt,
      href: `/rides/${ride.id}`,
    });
  }

  const loading = incoming.initialLoading || mine.initialLoading || active.initialLoading;
  const error = incoming.error ?? mine.error ?? active.error;

  return (
    <>
      <PageHeader
        title="Activity"
        lead="Everything waiting on you, and everything waiting on somebody else."
      />

      {error ? (
        <Card>
          <ErrorState
            {...resolveErrorCopy(error)}
            onRetry={() => {
              incoming.reload();
              mine.reload();
              active.reload();
            }}
          />
        </Card>
      ) : loading ? (
        <Card>
          <CardBody className="stack">
            <Skeleton width="60%" />
            <Skeleton width="45%" />
            <Skeleton width="52%" />
          </CardBody>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="bell"
            title="Nothing needs your attention"
            text="Seat requests, confirmations and trips in progress show up here."
            action={
              <Link className="btn btn-primary" to="/rides">
                Find a ride
              </Link>
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title={`${items.length} item${items.length === 1 ? '' : 's'}`} />
          <CardBody flush>
            <div className="table-responsive">
              <table className="table table--clickable">
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ width: 46 }}>
                        <span
                          className={
                            item.accent
                              ? 'card-statistic__icon card-statistic__icon--accent'
                              : 'card-statistic__icon'
                          }
                        >
                          <Icon name={item.icon} size={15} />
                        </span>
                      </td>
                      <td>
                        <Link to={item.href} className="t-medium">
                          {item.title}
                        </Link>
                        <div className="t-caption">{item.detail}</div>
                      </td>
                      <td className="t-caption t-right t-nowrap">{formatRelative(item.when)}</td>
                      <td style={{ width: 30 }}>
                        <Icon name="chevronRight" size={14} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {(incoming.data ?? []).length > 0 ? (
        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader title="Pending seat requests" lead="Accept or decline from the ride page" />
          <CardBody flush>
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {(incoming.data ?? []).map((request) => (
                    <tr key={request.id}>
                      <td>
                        <Identity
                          name={request.passenger.name}
                          meta={request.passenger.department ?? '—'}
                          size="sm"
                        />
                      </td>
                      <td>
                        <RequestStatusBadge status={request.status} />
                      </td>
                      <td className="t-right">
                        <Link className="btn btn-secondary btn-sm" to={`/rides/${request.rideId}`}>
                          Review
                          <Icon name="arrowRight" size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
