import { Link } from 'react-router-dom';
import {
  BOOKING_STATUS_LABEL,
  formatDate,
  formatMoney,
  formatTime,
  type Booking,
} from '@carpool/shared';
import { Badge, Button, Icon, Plate, RouteInline, type BadgeTone } from '@carpool/ui';

const TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  canceled: 'neutral',
  completed: 'ink',
};

/**
 * The passenger's booking card. It carries exactly the fields the platform
 * contract lists — route, departure, driver, vehicle, seats booked, estimated
 * cost, status — and only the two passenger actions.
 */
export function PassengerBookingCard({
  booking,
  onCancel,
}: {
  booking: Booking;
  onCancel?: (booking: Booking) => void;
}) {
  return (
    <article className="ride-card">
      <div className="ride-card__top">
        <div>
          <div className="ride-card__time">{formatTime(booking.departureAt)}</div>
          <div className="ride-card__date">{formatDate(booking.departureAt)}</div>
        </div>
        <Badge tone={TONE[booking.status] ?? 'neutral'}>{BOOKING_STATUS_LABEL[booking.status]}</Badge>
      </div>

      <RouteInline from={booking.startLocation} to={booking.destination} />

      <div className="ride-card__facts">
        <span className="ride-card__fact">
          <Icon name="user" size={13} />
          Driver: {booking.driver.name}
        </span>
        <span className="ride-card__fact">
          <Icon name="car" size={13} />
          Vehicle: {booking.vehicle.make} {booking.vehicle.model}
        </span>
        <Plate>{booking.vehicle.registrationNumber}</Plate>
        <span className="ride-card__fact">
          <Icon name="seat" size={13} />
          Seats booked: {booking.requestedSeats}
        </span>
      </div>

      <div className="ride-card__foot">
        <span className="t-caption">
          Estimated cost
          <div className="ride-card__price">{formatMoney(booking.estimatedCost, booking.currency)}</div>
        </span>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          <Link className="btn btn-secondary btn-sm" to={`/passenger/bookings/${booking.id}`}>
            View Booking
            <Icon name="arrowRight" size={14} />
          </Link>
          {booking.canCancel && onCancel ? (
            <Button variant="danger-outline" size="sm" onClick={() => onCancel(booking)}>
              Cancel Booking
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
