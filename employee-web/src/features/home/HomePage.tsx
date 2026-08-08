import { Link } from 'react-router-dom';
import { formatDistance, formatMoney, formatNumber, formatRelative, formatTime } from '@carpool/shared';
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
import { useRoleMode } from '../../lib/roleMode';
import { RideCard } from '../../components/RideCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Separated Driver & Passenger Dashboards.
 * Driver: Manage offered rides, vehicles, incoming passenger requests.
 * Passenger: Search open rides, view booked seats, trip history.
 */
export function HomePage() {
  const { user } = useAuth();
  const { isDriverMode, setRoleMode } = useRoleMode();
  const home = useApi(() => api.employee.home(), []);
  const data = home.data;
  const upcoming = data?.upcomingRides ?? [];
  const driving = upcoming.filter((ride) => ride.viewer.isDriver);
  const riding = upcoming.filter((ride) => !ride.viewer.isDriver);

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
            {home.initialLoading ? (
              <Skeleton variant="title" width="42%" />
            ) : (
              `${data?.greetingName ?? user?.name}.`
            )}
          </h1>
          <p className="section-header__lead">
            {isDriverMode ? 'Ready to offer a ride today?' : 'Where are you going?'}
          </p>
        </div>
        <div className="section-header__actions">
          {isDriverMode ? (
            <>
              <Link className="btn btn-accent btn-lg" to="/rides/new">
                <Icon name="plus" size={16} />
                Publish a ride
              </Link>
              <Link className="btn btn-secondary btn-lg" to="/vehicles">
                <Icon name="settings" size={16} />
                My Vehicles
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary btn-lg" to="/rides">
                <Icon name="search" size={16} />
                Find a ride
              </Link>
              <button className="btn btn-secondary btn-lg" onClick={() => setRoleMode('driver')}>
                <Icon name="car" size={16} />
                Driver View
              </button>
            </>
          )}
        </div>
      </div>

      {home.initialLoading ? (
        <div className="grid grid-split-tight">
          <Skeleton variant="block" height={210} />
          <Skeleton variant="block" height={210} />
        </div>
      ) : isDriverMode ? (
        /* ==================== DRIVER DASHBOARD ==================== */
        <>
          {data?.activeTrip && data.activeTrip.viewerRole === 'driver' ? (
            <Card style={{ marginBottom: 'var(--space-6)' }}>
              <CardHeader
                title="Your active trip as Driver"
                lead={`Started ${formatRelative(data.activeTrip.startedAt)}`}
                actions={<TripStatusBadge status={data.activeTrip.status} />}
              />
              <CardBody className="stack">
                <RouteTimeline from={data.activeTrip.startLocation} to={data.activeTrip.destination} />
                <div className="row-between">
                  <span className="t-caption">
                    {data.activeTrip.participants.length} passenger(s) on board · {data.activeTrip.vehicleSnapshot.make}{' '}
                    {data.activeTrip.vehicleSnapshot.model}
                  </span>
                  <Link className="btn btn-primary btn-sm" to={`/trips/${data.activeTrip.id}`}>
                    Manage Trip & Complete
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
                        {data.pendingIncomingRequests} passenger seat request
                        {data.pendingIncomingRequests === 1 ? '' : 's'} waiting for approval
                      </span>
                      <div className="t-caption">Accept or decline so your colleagues can plan their commute.</div>
                    </span>
                  </span>
                  <Link className="btn btn-primary btn-sm" to="/my-rides">
                    Review Bookings
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
            <div>
              <SectionHeading
                title="Rides you are offering"
                lead={
                  driving.length > 0
                    ? `${driving.length} upcoming published ride${driving.length === 1 ? '' : 's'}`
                    : 'Rides where you are the driver offering empty seats'
                }
                actions={
                  <Link className="btn btn-ghost btn-sm" to="/my-rides">
                    Manage offered rides
                    <Icon name="arrowRight" size={14} />
                  </Link>
                }
              />
              {driving.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="car"
                    title="No upcoming rides as a driver"
                    text="Offer empty seats on the daily commute you already make to share fuel costs."
                    action={
                      <Link className="btn btn-accent" to="/rides/new">
                        <Icon name="plus" size={16} />
                        Publish a new ride
                      </Link>
                    }
                  />
                </Card>
              ) : (
                <div className="stack">
                  {driving.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              )}
            </div>

            <div className="stack-lg">
              <div className="grid grid-split-tight">
                <Stat
                  label="Rides published"
                  value={formatNumber(data?.stats.ridesPublished ?? 0)}
                  icon="car"
                  small
                  accent
                />
                <Stat
                  label="Trips completed"
                  value={formatNumber(data?.stats.tripsCompleted ?? 0)}
                  icon="route"
                  small
                />
                <Stat
                  label="Distance shared"
                  value={formatDistance(data?.stats.distanceKm ?? 0)}
                  icon="trend"
                  small
                />
                <Stat
                  label="Cost recovered"
                  value={formatMoney(data?.stats.savedAmount ?? 0, data?.stats.currency)}
                  icon="wallet"
                  small
                />
              </div>

              <Card>
                <CardHeader
                  title="Driver history"
                  actions={
                    <Link className="btn btn-ghost btn-sm" to="/my-rides">
                      Offered rides log
                    </Link>
                  }
                />
                <CardBody flush>
                  {(data?.recentTrips ?? []).filter((t) => t.viewerRole === 'driver').length === 0 ? (
                    <EmptyState
                      icon="history"
                      title="No completed driver trips"
                      text="Your completed trips as a driver will show up here."
                    />
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <tbody>
                          {(data?.recentTrips ?? [])
                            .filter((t) => t.viewerRole === 'driver')
                            .map((trip) => (
                              <tr key={trip.id}>
                                <td>
                                  <Link to={`/trips/${trip.id}`} className="t-medium">
                                    {trip.startLocation} → {trip.destination}
                                  </Link>
                                  <div className="t-caption">
                                    You drove · {formatRelative(trip.completedAt ?? trip.startedAt)}
                                  </div>
                                </td>
                                <td className="t-right t-nowrap">
                                  <div className="t-medium">{formatDistance(trip.distanceKm)}</div>
                                  <div className="t-caption">
                                    {formatMoney(trip.totalCost, trip.currency)} total
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
                      Driver Mode Active
                      <div className="t-medium">Showing rides, vehicles, and bookings</div>
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
      ) : (
        /* ==================== PASSENGER DASHBOARD ==================== */
        <>
          {data?.activeTrip && data.activeTrip.viewerRole !== 'driver' ? (
            <Card style={{ marginBottom: 'var(--space-6)' }}>
              <CardHeader
                title="Your active trip as Passenger"
                lead={`Started ${formatRelative(data.activeTrip.startedAt)}`}
                actions={<TripStatusBadge status={data.activeTrip.status} />}
              />
              <CardBody className="stack">
                <RouteTimeline from={data.activeTrip.startLocation} to={data.activeTrip.destination} />
                <div className="row-between">
                  <span className="t-caption">
                    Riding in {data.activeTrip.vehicleSnapshot.make} {data.activeTrip.vehicleSnapshot.model}
                  </span>
                  <Link className="btn btn-primary btn-sm" to={`/trips/${data.activeTrip.id}`}>
                    View Details
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
            <div>
              <SectionHeading
                title="Your booked seats"
                lead={
                  riding.length > 0
                    ? `${riding.length} confirmed or pending seat${riding.length === 1 ? '' : 's'}`
                    : 'Rides where you hold or requested a seat'
                }
                actions={
                  <Link className="btn btn-ghost btn-sm" to="/trips">
                    My bookings
                    <Icon name="arrowRight" size={14} />
                  </Link>
                }
              />
              {riding.length === 0 ? (
                <Card>
                  <EmptyState
                    icon="seat"
                    title="No upcoming booked rides"
                    text="Search open rides published by colleagues to book your commute seat."
                    action={
                      <Link className="btn btn-primary" to="/rides">
                        <Icon name="search" size={16} />
                        Find a ride
                      </Link>
                    }
                  />
                </Card>
              ) : (
                <div className="stack">
                  {riding.map((ride) => (
                    <RideCard key={ride.id} ride={ride} />
                  ))}
                </div>
              )}

              <SectionHeading
                title="Available rides you can join"
                lead="Published by drivers in your organization"
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
                    title="No open rides available right now"
                    text="Check back soon or switch to Driver View if you'd like to publish a ride."
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
              <div className="grid grid-split-tight">
                <Stat
                  label="Bookings completed"
                  value={formatNumber(data?.stats.tripsCompleted ?? 0)}
                  icon="route"
                  small
                  accent
                />
                <Stat
                  label="Distance commuted"
                  value={formatDistance(data?.stats.distanceKm ?? 0)}
                  icon="trend"
                  small
                />
                <Stat
                  label="Saved by sharing"
                  value={formatMoney(data?.stats.savedAmount ?? 0, data?.stats.currency)}
                  icon="wallet"
                  small
                  foot={<span>versus solo taxis</span>}
                />
              </div>

              <Card>
                <CardHeader
                  title="Passenger ride history"
                  actions={
                    <Link className="btn btn-ghost btn-sm" to="/trips">
                      Trip history
                    </Link>
                  }
                />
                <CardBody flush>
                  {(data?.recentTrips ?? []).filter((t) => t.viewerRole === 'passenger').length === 0 ? (
                    <EmptyState
                      icon="history"
                      title="No completed passenger trips"
                      text="Your completed trips as a passenger will show up here."
                    />
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <tbody>
                          {(data?.recentTrips ?? [])
                            .filter((t) => t.viewerRole === 'passenger')
                            .map((trip) => (
                              <tr key={trip.id}>
                                <td>
                                  <Link to={`/trips/${trip.id}`} className="t-medium">
                                    {trip.startLocation} → {trip.destination}
                                  </Link>
                                  <div className="t-caption">
                                    You rode · {formatRelative(trip.completedAt ?? trip.startedAt)}
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
                      Passenger Mode Active
                      <div className="t-medium">Showing available rides and bookings</div>
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
