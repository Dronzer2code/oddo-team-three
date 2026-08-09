import { Router } from 'express';
import {
  BOOKING_STATUS,
  RIDE_REQUEST_STATUS,
  type Booking,
  type BookingStatus,
} from '@carpool/shared';
import { actorOf, authenticate, requireOperationalAccount, requireRole } from '../../middleware/auth.js';
import { parseId } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { isoRequired, num, round2, type Queryable } from '../../database/client.js';

/**
 * Bookings are the passenger's view of `ride_requests`. They are a separate
 * resource rather than a filter on rides because the passenger panel's My
 * Bookings tab has its own lifecycle — including COMPLETED, which exists only
 * once the trip finishes and has no equivalent on the request row itself.
 */
export const passengerBookingsRouter = Router();
passengerBookingsRouter.use(authenticate, requireRole('employee'));

const BOOKING_SELECT = `
SELECT rq.id, rq.organization_id, rq.ride_id, rq.passenger_id, rq.seats, rq.note,
       rq.status::text AS request_status, rq.created_at, rq.updated_at,
       r.start_location, r.destination, r.departure_at, r.cost_per_seat, r.currency,
       r.status::text AS ride_status,
       d.id AS driver_id, d.name AS driver_name, d.department AS driver_department, d.phone AS driver_phone,
       v.id AS vehicle_id, v.make, v.model, v.registration_number, v.vehicle_type,
       v.seating_capacity, v.color,
       t.id AS trip_id, t.status::text AS trip_status
  FROM ride_requests rq
  JOIN rides r ON r.id = rq.ride_id
  JOIN users d ON d.id = r.driver_id
  JOIN vehicles v ON v.id = r.vehicle_id
  LEFT JOIN trips t ON t.ride_id = r.id
 WHERE rq.organization_id = $1::uuid AND rq.passenger_id = $2::uuid`;

/**
 * An accepted request becomes COMPLETED once its trip closes — otherwise the
 * booking status is the request status under the passenger's vocabulary.
 */
function resolveStatus(row: Record<string, any>): BookingStatus {
  const request = row.request_status as string;
  if (request === RIDE_REQUEST_STATUS.ACCEPTED) {
    if (row.trip_status === 'completed') return BOOKING_STATUS.COMPLETED;
    if (row.trip_status === 'canceled' || row.ride_status === 'canceled') return BOOKING_STATUS.CANCELED;
    return BOOKING_STATUS.CONFIRMED;
  }
  if (request === RIDE_REQUEST_STATUS.REJECTED) return BOOKING_STATUS.REJECTED;
  if (request === RIDE_REQUEST_STATUS.CANCELED) return BOOKING_STATUS.CANCELED;
  return BOOKING_STATUS.PENDING;
}

function mapBooking(row: Record<string, any>): Booking {
  const status = resolveStatus(row);
  const seats = num(row.seats, 1);
  const accepted = row.request_status === RIDE_REQUEST_STATUS.ACCEPTED;

  return {
    id: row.id,
    organizationId: row.organization_id,
    rideId: row.ride_id,
    passengerId: row.passenger_id,
    requestedSeats: seats,
    status,
    requestStatus: row.request_status,
    estimatedCost: round2(num(row.cost_per_seat) * seats),
    currency: (row.currency ?? 'INR').trim(),
    note: row.note ?? null,
    driver: {
      id: row.driver_id,
      name: row.driver_name,
      department: row.driver_department ?? null,
      // A phone number is only useful — and only appropriate — once the seat
      // is actually confirmed.
      ...(accepted ? { phone: row.driver_phone ?? null } : {}),
    },
    vehicle: {
      id: row.vehicle_id,
      make: row.make,
      model: row.model,
      registrationNumber: row.registration_number,
      vehicleType: row.vehicle_type,
      seatingCapacity: num(row.seating_capacity),
      color: row.color ?? null,
    },
    startLocation: row.start_location,
    destination: row.destination,
    departureAt: isoRequired(row.departure_at),
    rideStatus: row.ride_status,
    tripId: row.trip_id ?? null,
    canCancel:
      (status === BOOKING_STATUS.PENDING || status === BOOKING_STATUS.CONFIRMED) &&
      !['in_progress', 'completed', 'canceled'].includes(String(row.ride_status)),
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
  };
}

async function loadBooking(
  db: Queryable,
  organizationId: string,
  passengerId: string,
  bookingId: string,
): Promise<Booking> {
  const { rows } = await db.query(`${BOOKING_SELECT} AND rq.id = $3::uuid`, [
    organizationId,
    passengerId,
    bookingId,
  ]);
  const row = rows[0] as Record<string, any> | undefined;
  if (!row) throw errors.notFound('That booking is not available');
  return mapBooking(row);
}

/**
 * GET /api/passenger/bookings
 * Always scoped to the authenticated passenger — the client cannot widen it.
 * `?status=` accepts the My Bookings filter values.
 */
passengerBookingsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(`${BOOKING_SELECT} ORDER BY r.departure_at DESC LIMIT 200`, [
      actor.organizationId,
      actor.id,
    ]);

    const bookings = rows.map((row) => mapBooking(row as Record<string, any>));
    const filter = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered =
      filter && filter !== 'all' ? bookings.filter((booking) => booking.status === filter) : bookings;

    return ok(res, filtered);
  }),
);

/** GET /api/passenger/bookings/:id */
passengerBookingsRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const bookingId = parseId(req.params.id, 'booking id');
    return ok(res, await loadBooking(req.db, actor.organizationId, actor.id, bookingId));
  }),
);

/**
 * PATCH /api/passenger/bookings/:id/cancel
 * Releases the seat back to the ride when the booking was already confirmed.
 */
passengerBookingsRouter.patch(
  '/:id/cancel',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const bookingId = parseId(req.params.id, 'booking id');

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{
        ride_id: string;
        passenger_id: string;
        seats: unknown;
        status: string;
      }>(
        `SELECT ride_id, passenger_id, seats, status::text AS status
           FROM ride_requests
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [bookingId, actor.organizationId],
      );
      const booking = rows[0];
      if (!booking) throw errors.notFound('That booking is not available');
      if (booking.passenger_id !== actor.id) throw errors.forbidden('You can only cancel your own booking');
      if (!['pending', 'accepted'].includes(booking.status)) {
        throw errors.ruleViolation(`This booking is already ${booking.status}`);
      }

      const rideResult = await tx.query<{ status: string }>(
        `SELECT status::text AS status FROM rides WHERE id = $1::uuid FOR UPDATE`,
        [booking.ride_id],
      );
      const rideStatus = rideResult.rows[0]?.status;
      if (rideStatus === 'in_progress') {
        throw errors.ruleViolation('This ride has already started — talk to the driver instead');
      }
      if (rideStatus === 'completed') {
        throw errors.ruleViolation('This ride is already completed');
      }

      await tx.query(`UPDATE ride_requests SET status = 'canceled'::ride_request_status WHERE id = $1::uuid`, [
        bookingId,
      ]);

      // Only an accepted booking was holding a seat.
      if (booking.status === RIDE_REQUEST_STATUS.ACCEPTED) {
        await tx.query(
          `UPDATE rides
              SET seats_taken = GREATEST(0, seats_taken - $2::int),
                  status = CASE WHEN status = 'full'::ride_status THEN 'published'::ride_status ELSE status END
            WHERE id = $1::uuid`,
          [booking.ride_id, num(booking.seats, 1)],
        );
      }
    });

    const booking = await loadBooking(req.db, actor.organizationId, actor.id, bookingId);
    return ok(res, booking, 'Booking canceled');
  }),
);
