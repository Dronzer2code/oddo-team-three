import { Link } from 'react-router-dom';
import { formatDate, formatTime, type Ride } from '@carpool/shared';
import { Badge, Button, Icon, Plate, RideStatusBadge, RouteInline, Seats } from '@carpool/ui';

/**
 * The driver's own ride. It says "You are driving" and carries the driver's
 * actions, so it must never be rendered anywhere in the passenger panel — see
 * the component-separation rule in the platform contract.
 */
export function DriverRideCard({
  ride,
  pendingRequests = 0,
  onCancel,
  onStartTrip,
}: {
  ride: Ride;
  pendingRequests?: number;
  onCancel?: (ride: Ride) => void;
  onStartTrip?: (ride: Ride) => void;
}) {
  const upcoming = ride.status === 'published' || ride.status === 'full';

  return (
    <article className="ride-card">
      <div className="ride-card__top">
        <div>
          <Badge tone="ink">You are driving</Badge>
          <div className="ride-card__time" style={{ marginTop: 6 }}>
            {formatTime(ride.departureAt)}
          </div>
          <div className="ride-card__date">{formatDate(ride.departureAt)}</div>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {pendingRequests > 0 ? <Badge tone="warning">{pendingRequests} pending</Badge> : null}
          <RideStatusBadge status={ride.status} />
        </div>
      </div>

      <RouteInline from={ride.startLocation} to={ride.destination} />

      <div className="ride-card__facts">
        <span className="ride-card__fact">
          <Icon name="car" size={13} />
          {ride.vehicle.make} {ride.vehicle.model}
        </span>
        <Plate>{ride.vehicle.registrationNumber}</Plate>
        <span className="ride-card__fact">
          <Icon name="seat" size={13} />
          Available seats: {ride.seatsAvailable} of {ride.totalSeats}
        </span>
        <span className="ride-card__fact">
          <Seats total={ride.totalSeats} taken={ride.seatsTaken} />
        </span>
      </div>

      <div className="ride-card__foot">
        <span className="t-caption">Status: {ride.status === 'full' ? 'Full' : ride.status === 'published' ? 'Published' : ride.status.replace('_', ' ')}</span>
        <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary btn-sm" to={`/driver/rides/${ride.id}`}>
            View Ride
          </Link>
          <Link className="btn btn-secondary btn-sm" to={`/driver/rides/${ride.id}/requests`}>
            Manage Requests
            {pendingRequests > 0 ? <span className="nav-link__badge">{pendingRequests}</span> : null}
          </Link>
          {upcoming && onStartTrip ? (
            <Button variant="primary" size="sm" icon="play" onClick={() => onStartTrip(ride)}>
              Start Trip
            </Button>
          ) : null}
          {upcoming && onCancel ? (
            <Button variant="danger-outline" size="sm" onClick={() => onCancel(ride)}>
              Cancel Ride
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
