import { Link } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDistance,
  formatMoney,
  formatTime,
  formatDate,
  type Ride,
} from '@carpool/shared';
import { Badge, Icon, Identity, Plate, RideStatusBadge, RouteInline, Seats } from '@carpool/ui';

/**
 * The core object of the employee application: a route-oriented card that
 * answers driver / vehicle / pickup / destination / departure / seats /
 * distance / cost at a glance.
 */
export function RideCard({ ride, action }: { ride: Ride; action?: React.ReactNode }) {
  return (
    <article className="ride-card">
      <div className="ride-card__top">
        <div>
          <div className="ride-card__time">{formatTime(ride.departureAt)}</div>
          <div className="ride-card__date">{formatDate(ride.departureAt)}</div>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {ride.viewer.isDriver ? <Badge tone="ink">You are driving</Badge> : null}
          {ride.viewer.requestStatus === 'accepted' ? <Badge tone="success">Seat confirmed</Badge> : null}
          {ride.viewer.requestStatus === 'pending' ? <Badge tone="warning">Request pending</Badge> : null}
          <RideStatusBadge status={ride.status} />
        </div>
      </div>

      <RouteInline from={ride.startLocation} to={ride.destination} />

      <div className="ride-card__facts">
        <span className="ride-card__fact">
          <Icon name="trend" size={13} />
          {formatDistance(ride.estimatedDistanceKm)}
        </span>
        <span className="ride-card__fact">
          <Icon name="seat" size={13} />
          {ride.seatsAvailable} of {ride.totalSeats} free
        </span>
        <span className="ride-card__fact">
          <Seats total={ride.totalSeats} taken={ride.seatsTaken} />
        </span>
        <span className="ride-card__fact">
          <Icon name="car" size={13} />
          {ride.vehicle.make} {ride.vehicle.model}
          <span className="t-muted">· {VEHICLE_TYPE_LABEL[ride.vehicle.vehicleType]}</span>
        </span>
        <Plate>{ride.vehicle.registrationNumber}</Plate>
      </div>

      <div className="ride-card__foot">
        <Identity
          name={ride.viewer.isDriver ? 'You' : ride.driver.name}
          meta={ride.driver.department ?? 'Driver'}
          size="sm"
        />
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <span className="ride-card__price">
            {formatMoney(ride.costPerSeat, ride.currency)} <small>per seat</small>
          </span>
          {action ?? (
            <Link className="btn btn-secondary btn-sm" to={`/rides/${ride.id}`}>
              View ride
              <Icon name="arrowRight" size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
