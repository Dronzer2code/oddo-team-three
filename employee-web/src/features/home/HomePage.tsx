import { Link } from 'react-router-dom';
import {
  formatDistance,
  formatMoney,
  formatNumber,
  formatRelative,
  formatTime,
} from '@carpool/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  RouteTimeline,
  SectionHeading,
  Skeleton,
  Stat,
  TripStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { RideCard } from '../../components/RideCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Answers one question: what do I need to do with my commute today?
 * Deliberately not a dashboard.
 */
export function HomePage() {
  const { user } = useAuth();
  const home = useApi(() => api.employee.home(), []);
  const data = home.data;

  if (home.error) {
    return (
      <Card>
        <ErrorState {...resolveErrorCopy(home.error)} onRetry={home.reload} />
      </Card>
    );
  }

  return (
    <>
      <div className="section-header">
        <div className="section-header__text">
          <p className="t-label">{greeting()}</p>
          <h1 className="section-header__title">
            {home.initialLoading ? <Skeleton variant="title" width="42%" /> : `${data?.greetingName ?? user?.name}.`}
          </h1>
          <p className="section-header__lead">Where are you going?</p>
        </div>
        <div className="section-header__actions">
          <Link className="btn btn-primary btn-lg" to="/rides">
            <Icon name="search" size={16} />
            Find a ride
          </Link>
          <Link className="btn btn-accent btn-lg" to="/rides/new">
            <Icon name="plus" size={16} />
            Publish a ride
          </Link>
        </div>
      </div>

      {home.initialLoading ? (
        <div className="grid grid-2">
          <Skeleton variant="block" height={210} />
          <Skeleton variant="block" height={210} />
        </div>
      ) : (
        <>
          {data?.activeTrip ? (
            <Card style={{ marginBottom: 'var(--space-6)' }}>
              <CardHeader
                title="Trip in progress"
                lead={`Started ${formatRelative(data.activeTrip.startedAt)}`}
                actions={<TripStatusBadge status={data.activeTrip.status} />}
              />
              <CardBody className="stack">
                <RouteTimeline from={data.activeTrip.startLocation} to={data.activeTrip.destination} />
                <div className="row-between">
                  <span className="t-caption">
                    {data.activeTrip.participants.length} on board ·{' '}
                    {data.activeTrip.vehicleSnapshot.make} {data.activeTrip.vehicleSnapshot.model}
                  </span>
                  <Link className="btn btn-primary btn-sm" to={`/trips/${data.activeTrip.id}`}>
                    Manage trip
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {data && data.pendingIncomingRequests > 0 ? (
            <Card style={{ marginBottom: 'var(--space-6)' }}>
              <CardBody tight>
                <div className="row-between">
                  <span className="row" style={{ gap: 'var(--space-3)' }}>
                    <span className="card-statistic__icon card-statistic__icon--accent">
                      <Icon name="seat" size={15} />
                    </span>
                    <span>
                      <span className="t-medium">
                        {data.pendingIncomingRequests} seat request
                        {data.pendingIncomingRequests === 1 ? '' : 's'} waiting for you
                      </span>
                      <div className="t-caption">Accept or decline so your passengers can plan.</div>
                    </span>
                  </span>
                  <Link className="btn btn-secondary btn-sm" to="/my-rides">
                    Review requests
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-2" style={{ gridTemplateColumns: '1.35fr 1fr', alignItems: 'start' }}>
            <div>
              <SectionHeading
                title="Your next rides"
                lead="Rides you are driving or have a confirmed seat on"
                actions={
                  <Link className="btn btn-ghost btn-sm" to="/my-rides">
                    All my rides
                    <Icon name="arrowRight" size={14} />
                  </Link>
                }
              />
              {(data?.upcomingRides ?? []).length === 0 ? (
                <Card>
                  <EmptyState
                    icon="car"
                    title="No upcoming rides"
                    text="Your next commute will appear here. Find a ride with a colleague, or offer the seats in your car."
                    action={
                      <div className="row">
                        <Link className="btn btn-primary" to="/rides">
                          Find a ride
                        </Link>
                        <Link className="btn btn-secondary" to="/rides/new">
                          Publish a ride
                        </Link>
                      </div>
                    }
                  />
                </Card>
              ) : (
                <div className="stack">
                  {(data?.upcomingRides ?? []).map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              )}

              <SectionHeading
                title="Available near you"
                lead="Open rides in your organization"
                actions={
                  <Link className="btn btn-ghost btn-sm" to="/rides">
                    Search all
                    <Icon name="arrowRight" size={14} />
                  </Link>
                }
              />
              {(data?.suggestions ?? []).length === 0 ? (
                <Card>
                  <EmptyState
                    icon="search"
                    title="Nothing open right now"
                    text="Nobody has published a ride you can join yet. Publishing one yourself is the fastest way to fill a car."
                    action={
                      <Link className="btn btn-primary" to="/rides/new">
                        Publish a ride
                      </Link>
                    }
                  />
                </Card>
              ) : (
                <div className="stack">
                  {(data?.suggestions ?? []).map((ride) => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      action={
                        <Link className="btn btn-primary btn-sm" to={`/rides/${ride.id}`}>
                          Request seat
                          <Icon name="arrowRight" size={14} />
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="stack-lg">
              <div className="grid grid-2">
                <Stat
                  label="Trips completed"
                  value={formatNumber(data?.stats.tripsCompleted ?? 0)}
                  icon="route"
                  small
                  accent
                />
                <Stat label="Distance shared" value={formatDistance(data?.stats.distanceKm ?? 0)} icon="trend" small />
                <Stat
                  label="Rides published"
                  value={formatNumber(data?.stats.ridesPublished ?? 0)}
                  icon="car"
                  small
                />
                <Stat
                  label="Saved by sharing"
                  value={formatMoney(data?.stats.savedAmount ?? 0, data?.stats.currency)}
                  icon="wallet"
                  small
                  foot={<span>versus driving alone</span>}
                />
              </div>

              <Card>
                <CardHeader
                  title="Recent activity"
                  actions={
                    <Link className="btn btn-ghost btn-sm" to="/trips">
                      Trip history
                    </Link>
                  }
                />
                <CardBody flush>
                  {(data?.recentTrips ?? []).length === 0 ? (
                    <EmptyState icon="history" title="No trips yet" text="Your completed trips will show up here." />
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <tbody>
                          {(data?.recentTrips ?? []).map((trip) => (
                            <tr key={trip.id}>
                              <td>
                                <Link to={`/trips/${trip.id}`} className="t-medium">
                                  {trip.startLocation} → {trip.destination}
                                </Link>
                                <div className="t-caption">
                                  {trip.viewerRole === 'driver' ? 'You drove' : 'You rode'} ·{' '}
                                  {formatRelative(trip.completedAt ?? trip.startedAt)}
                                </div>
                              </td>
                              <td className="t-right t-nowrap">
                                <div className="t-medium">{formatDistance(trip.distanceKm)}</div>
                                <div className="t-caption">
                                  {trip.viewerShare !== null
                                    ? formatMoney(trip.viewerShare, trip.currency)
                                    : formatMoney(trip.totalCost, trip.currency)}
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

              <Card>
                <CardBody tight>
                  <div className="row-between">
                    <span className="t-caption">
                      Next departure
                      <div className="t-medium">
                        {data?.upcomingRides[0]
                          ? `${formatTime(data.upcomingRides[0].departureAt)} · ${data.upcomingRides[0].startLocation}`
                          : 'Nothing scheduled'}
                      </div>
                    </span>
                    <Button variant="ghost" size="sm" icon="refresh" onClick={home.reload}>
                      Refresh
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
