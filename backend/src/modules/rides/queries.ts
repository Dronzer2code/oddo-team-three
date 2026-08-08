/**
 * Canonical ride projection. Every ride response is built from this so the
 * shape — including viewer-relative request state — is identical everywhere.
 *
 * $1 = organization id (from the session, never the client)
 * $2 = viewer id
 */
export const RIDE_BASE_SELECT = `
SELECT r.id, r.organization_id, r.driver_id, r.vehicle_id,
       r.start_location, r.destination, r.departure_at,
       r.total_seats, r.seats_taken,
       r.estimated_distance_km, r.estimated_cost, r.cost_per_seat, r.currency,
       r.notes, r.status, r.created_at,
       d.name AS driver_name, d.department AS driver_department, d.phone AS driver_phone,
       v.make, v.model, v.registration_number, v.vehicle_type, v.seating_capacity, v.color,
       t.id AS trip_id,
       vr.id AS viewer_request_id, vr.status::text AS viewer_request_status
  FROM rides r
  JOIN users d ON d.id = r.driver_id
  JOIN vehicles v ON v.id = r.vehicle_id
  LEFT JOIN trips t ON t.ride_id = r.id
  LEFT JOIN LATERAL (
    SELECT rq.id, rq.status
      FROM ride_requests rq
     WHERE rq.ride_id = r.id AND rq.passenger_id = $2::uuid
     ORDER BY CASE rq.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, rq.created_at DESC
     LIMIT 1
  ) vr ON TRUE
 WHERE r.organization_id = $1::uuid`;

export const RIDE_REQUEST_SELECT = `
SELECT rq.id, rq.ride_id, rq.passenger_id, rq.seats, rq.status, rq.note,
       rq.created_at, rq.updated_at,
       p.name AS passenger_name, p.department AS passenger_department, p.phone AS passenger_phone
  FROM ride_requests rq
  JOIN users p ON p.id = rq.passenger_id`;
