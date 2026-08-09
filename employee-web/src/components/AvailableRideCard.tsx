import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDate,
  formatDistance,
  formatMoney,
  formatTime,
  type Ride,
} from '@carpool/shared';
import { Badge, Icon, Identity, Plate, RouteInline, Seats } from '@carpool/ui';

/**
 * A ride a passenger could join. Passenger-facing only: it never says "You are
 * driving" and it never carries a driver action, so it cannot leak driver
 * controls into the passenger panel.
 */
export function AvailableRideCard({ ride, action }: { ride: Ride; action?: ReactNode }) {
  return (
    <article className="ride-card">
      <div className="ride-card__top">
        <div>
          <div className="ride-card__time">{formatTime(ride.departureAt)}</div>
          <div className="ride-card__date">{formatDate(ride.departureAt)}</div>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {ride.viewer.requestStatus === 'accepted' ? <Badge tone="success">Seat confirmed</Badge> : null}
          {ride.viewer.requestStatus === 'pending' ? <Badge tone="warning">Request pending</Badge> : null}
          <Badge tone="accent">{ride.seatsAvailable} seats free</Badge>
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
        <Identity name={ride.driver.name} meta={ride.driver.department ?? 'Driver'} size="sm" />
        <div className="row" style={{ gap: 'var(--space-4)' }}>
          <span className="ride-card__price">
            {formatMoney(ride.costPerSeat, ride.currency)} <small>per seat</small>
          </span>
          {action ?? (
            <Link className="btn btn-secondary btn-sm" to={`/passenger/rides/${ride.id}`}>
              View Ride
              <Icon name="arrowRight" size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
