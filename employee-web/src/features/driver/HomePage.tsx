import { Link } from 'react-router-dom';
import { formatDistance, formatMoney, formatNumber, formatRelative } from '@carpool/shared';
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
import { usePanelAccess } from '../../lib/panels';
import { DriverRideCard } from '../../components/DriverRideCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The driver's home: the rides they are offering and the requests waiting. */
export function DriverHomePage() {
  const { user } = useAuth();
  const { hasDriverContext, awaitingApproval, hasVehicle } = usePanelAccess();

  const home = useApi(() => api.employee.home(), []);
  const mine = useApi(() => api.employee.rides.mine(), []);
  const requests = useApi(() => api.employee.rides.incomingRequests(), []);

  const data = home.data;
  const driving = (mine.data?.driving ?? []).filter(
    (ride) => ride.status === 'published' || ride.status === 'full',
  );
  const pending = requests.data ?? [];
  const activeTrip = data?.activeTrip && data.activeTrip.viewerRole === 'driver' ? data.activeTrip : null;

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
          <p className="section-header__lead">Ready to offer a ride today?</p>
        </div>
        <div className="section-header__actions">
          {hasDriverContext ? (
            <Link className="btn btn-accent btn-lg" to="/driver/rides/new">
              <Icon name="plus" size={16} />
              Publish Ride
            </Link>
          ) : (
            <Link className="btn btn-primary btn-lg" to={hasVehicle ? '/driver/vehicle' : '/driver/vehicle/register'}>
              <Icon name="car" size={16} />
              {hasVehicle ? 'My Vehicle' : 'Register Vehicle'}
            </Link>
          )}
        </div>
      </div>

      {!hasDriverContext ? (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardBody className="stack">
            <h2 className="t-subtitle">
              {awaitingApproval ? 'Your vehicle is waiting for approval' : 'Register a vehicle to start driving'}
            </h2>
            <p className="t-caption">
              {awaitingApproval
                ? 'Publishing opens automatically the moment an administrator approves it — this page updates itself.'
                : 'You need one approved, active vehicle before you can publish a ride.'}
            </p>
            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <Link className="btn btn-primary btn-sm" to="/driver/vehicle">
                My Vehicle
                <Icon name="arrowRight" size={14} />
              </Link>
              {!hasVehicle ? (
                <Link className="btn btn-secondary btn-sm" to="/driver/vehicle/register">
                  Register Vehicle
                </Link>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {activeTrip ? (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader
            title="Your active trip"
            lead={`Started ${formatRelative(activeTrip.startedAt)}`}
            actions={<TripStatusBadge status={activeTrip.status} />}
          />
          <CardBody className="stack">
            <RouteTimeline from={activeTrip.startLocation} to={activeTrip.destination} />
            <div className="row-between">
              <span className="t-caption">
                {activeTrip.participants.filter((participant) => participant.role === 'passenger').length}{' '}
                passenger(s) on board · {activeTrip.vehicleSnapshot.make} {activeTrip.vehicleSnapshot.model}
              </span>
              <Link className="btn btn-primary btn-sm" to="/driver/active-trip">
                Manage trip
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardBody tight>
            <div className="row-between">
              <span className="row" style={{ gap: 'var(--space-3)' }}>
                <span className="card-statistic__icon card-statistic__icon--accent">
                  <Icon name="seat" size={15} />
                </span>
                <span>
                  <span className="t-medium">
                    {pending.length} passenger seat request{pending.length === 1 ? '' : 's'} waiting for approval
                  </span>
                  <div className="t-caption">Accept or reject so your colleagues can plan their commute.</div>
                </span>
              </span>
              <Link className="btn btn-primary btn-sm" to="/driver/requests">
                Requests
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
              <Link className="btn btn-ghost btn-sm" to="/driver/rides">
                My Rides
                <Icon name="arrowRight" size={14} />
              </Link>
            }
          />
          {mine.initialLoading ? (
            <Skeleton variant="block" height={200} />
          ) : driving.length === 0 ? (
            <Card>
              <EmptyState
                icon="car"
                title="No upcoming rides"
                text="Offer empty seats on the commute you already make to share fuel costs."
                action={
                  hasDriverContext ? (
                    <Link className="btn btn-accent" to="/driver/rides/new">
                      <Icon name="plus" size={16} />
                      Publish Ride
                    </Link>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="stack">
              {driving.map((ride) => (
                <DriverRideCard
                  key={ride.id}
                  ride={ride}
                  pendingRequests={pending.filter((request) => request.rideId === ride.id).length}
                />
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
            <Stat label="Distance shared" value={formatDistance(data?.stats.distanceKm ?? 0)} icon="trend" small />
            <Stat
              label="Cost recovered"
              value={formatMoney(data?.stats.savedAmount ?? 0, data?.stats.currency)}
              icon="wallet"
              small
            />
          </div>

          <Card>
            <CardHeader
              title="Recent trips"
              actions={
                <Link className="btn btn-ghost btn-sm" to="/driver/history">
                  Trip History
                </Link>
              }
            />
            <CardBody flush>
              {(data?.recentTrips ?? []).filter((trip) => trip.viewerRole === 'driver').length === 0 ? (
                <EmptyState
                  icon="history"
                  title="No completed trips yet"
                  text="Your completed trips as a driver will show up here."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {(data?.recentTrips ?? [])
                        .filter((trip) => trip.viewerRole === 'driver')
                        .map((trip) => (
                          <tr key={trip.id}>
                            <td>
                              <span className="t-medium">
                                {trip.startLocation} → {trip.destination}
                              </span>
                              <div className="t-caption">
                                You drove · {formatRelative(trip.completedAt ?? trip.startedAt)}
                              </div>
                            </td>
                            <td className="t-right t-nowrap">
                              <div className="t-medium">{formatDistance(trip.distanceKm)}</div>
                              <div className="t-caption">{formatMoney(trip.totalCost, trip.currency)} total</div>
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
                  Driver Panel
                  <div className="t-medium">Rides, vehicles and passenger requests</div>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    home.reload();
                    mine.reload();
                    requests.reload();
                  }}
                >
                  Refresh
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
