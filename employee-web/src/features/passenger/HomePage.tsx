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
import { AvailableRideCard } from '../../components/AvailableRideCard';
import { PassengerBookingCard } from '../../components/PassengerBookingCard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The passenger's home. It shows the welcome, the Find a Ride action, the
 * upcoming booking, the active trip, recent activity and suggested rides —
 * and deliberately nothing about driving: no published rides, no vehicle, no
 * passenger requests to manage, no earnings.
 */
export function PassengerHomePage() {
  const { user } = useAuth();
  const home = useApi(() => api.employee.home(), []);
  const bookings = useApi(() => api.passenger.bookings.list(), []);

  const data = home.data;
  const all = bookings.data ?? [];
  const upcoming = all.filter((booking) => booking.status === 'confirmed' || booking.status === 'pending');
  const confirmed = all.filter((booking) => booking.status === 'confirmed').length;
  const pending = all.filter((booking) => booking.status === 'pending').length;
  const activeTrip = data?.activeTrip && data.activeTrip.viewerRole !== 'driver' ? data.activeTrip : null;

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
          <p className="section-header__lead">Where are you going?</p>
        </div>
        <div className="section-header__actions">
          <Link className="btn btn-primary btn-lg" to="/passenger/rides">
            <Icon name="search" size={16} />
            Find a Ride
          </Link>
        </div>
      </div>

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
                Riding in {activeTrip.vehicleSnapshot.make} {activeTrip.vehicleSnapshot.model} ·{' '}
                {activeTrip.driverName}
              </span>
              <Link className="btn btn-primary btn-sm" to="/passenger/live-trip">
                Track trip
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div>
          <SectionHeading
            title="Your upcoming bookings"
            lead={
              upcoming.length > 0
                ? `${confirmed} confirmed · ${pending} waiting for a driver`
                : 'Seats you hold or have requested'
            }
            actions={
              <Link className="btn btn-ghost btn-sm" to="/passenger/bookings">
                My Bookings
                <Icon name="arrowRight" size={14} />
              </Link>
            }
          />
          {bookings.initialLoading ? (
            <Skeleton variant="block" height={180} />
          ) : upcoming.length === 0 ? (
            <Card>
              <EmptyState
                icon="seat"
                title="No upcoming bookings"
                text="Search open rides published by colleagues to book your commute seat."
                action={
                  <Link className="btn btn-primary" to="/passenger/rides">
                    <Icon name="search" size={16} />
                    Find a Ride
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="stack">
              {upcoming.slice(0, 3).map((booking) => (
                <PassengerBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}

          <SectionHeading
            title="Suggested rides"
            lead="Published by drivers in your organization"
            actions={
              <Link className="btn btn-ghost btn-sm" to="/passenger/rides">
                Search all
                <Icon name="arrowRight" size={14} />
              </Link>
            }
          />
          {home.initialLoading ? (
            <Skeleton variant="block" height={180} />
          ) : (data?.suggestions ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon="search"
                title="No open rides available right now"
                text="Check back shortly — colleagues publish rides throughout the day."
              />
            </Card>
          ) : (
            <div className="stack">
              {(data?.suggestions ?? []).map((ride) => (
                <AvailableRideCard
                  key={ride.id}
                  ride={ride}
                  action={
                    <Link className="btn btn-primary btn-sm" to={`/passenger/rides/${ride.id}`}>
                      Request Seat
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
            <Stat label="Bookings confirmed" value={formatNumber(confirmed)} icon="seat" small accent />
            <Stat
              label="Trips completed"
              value={formatNumber(data?.stats.tripsCompleted ?? 0)}
              icon="route"
              small
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
              title="Recent activity"
              actions={
                <Link className="btn btn-ghost btn-sm" to="/passenger/history">
                  History
                </Link>
              }
            />
            <CardBody flush>
              {(data?.recentTrips ?? []).filter((trip) => trip.viewerRole === 'passenger').length === 0 ? (
                <EmptyState
                  icon="history"
                  title="Nothing here yet"
                  text="Your completed trips will show up here."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {(data?.recentTrips ?? [])
                        .filter((trip) => trip.viewerRole === 'passenger')
                        .map((trip) => (
                          <tr key={trip.id}>
                            <td>
                              <span className="t-medium">
                                {trip.startLocation} → {trip.destination}
                              </span>
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
                  Booking summary
                  <div className="t-medium">
                    {all.length} booking{all.length === 1 ? '' : 's'} in total
                  </div>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() => {
                    home.reload();
                    bookings.reload();
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
