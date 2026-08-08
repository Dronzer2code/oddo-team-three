import type {
  AuditLogEntry,
  CostConfiguration,
  Invitation,
  Payment,
  Ride,
  RideRequest,
  RideVehicle,
  Trip,
  TripParticipant,
  Vehicle,
} from '@carpool/shared';
import { bool, iso, isoRequired, json, num } from '../database/client.js';

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export function mapVehicle(row: Record<string, any>): Vehicle {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? '',
    make: row.make,
    model: row.model,
    registrationNumber: row.registration_number,
    vehicleType: row.vehicle_type,
    seatingCapacity: num(row.seating_capacity),
    color: row.color ?? null,
    status: row.status,
    createdAt: isoRequired(row.created_at),
  };
}

export function mapRideVehicle(row: Record<string, any>): RideVehicle {
  return {
    id: row.vehicle_id ?? row.id,
    make: row.make,
    model: row.model,
    registrationNumber: row.registration_number,
    vehicleType: row.vehicle_type,
    seatingCapacity: num(row.seating_capacity),
    color: row.color ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Rides                                                              */
/* ------------------------------------------------------------------ */

export interface RideMapOptions {
  viewerId: string;
  /** Phone numbers are only exposed to the driver and accepted passengers. */
  revealDriverPhone?: boolean;
}

export function mapRide(row: Record<string, any>, options: RideMapOptions): Ride {
  const seatsAvailable = Math.max(0, num(row.total_seats) - num(row.seats_taken));
  const isDriver = row.driver_id === options.viewerId;
  const requestStatus = row.viewer_request_status ?? null;
  const reveal = options.revealDriverPhone ?? (isDriver || requestStatus === 'accepted');

  return {
    id: row.id,
    organizationId: row.organization_id,
    driver: {
      id: row.driver_id,
      name: row.driver_name,
      department: row.driver_department ?? null,
      ...(reveal ? { phone: row.driver_phone ?? null } : {}),
    },
    vehicle: mapRideVehicle(row),
    startLocation: row.start_location,
    destination: row.destination,
    departureAt: isoRequired(row.departure_at),
    totalSeats: num(row.total_seats),
    seatsTaken: num(row.seats_taken),
    seatsAvailable,
    estimatedDistanceKm: num(row.estimated_distance_km),
    estimatedCost: num(row.estimated_cost),
    costPerSeat: num(row.cost_per_seat),
    currency: (row.currency ?? 'INR').trim(),
    notes: row.notes ?? null,
    status: row.status,
    createdAt: isoRequired(row.created_at),
    viewer: {
      isDriver,
      requestStatus,
      requestId: row.viewer_request_id ?? null,
      canRequest:
        !isDriver &&
        row.status === 'published' &&
        seatsAvailable > 0 &&
        !['pending', 'accepted'].includes(requestStatus ?? '') &&
        new Date(isoRequired(row.departure_at)).getTime() > Date.now(),
    },
    tripId: row.trip_id ?? null,
  };
}

export function mapRideRequest(row: Record<string, any>, revealPhone = false): RideRequest {
  return {
    id: row.id,
    rideId: row.ride_id,
    passenger: {
      id: row.passenger_id,
      name: row.passenger_name,
      department: row.passenger_department ?? null,
      ...(revealPhone ? { phone: row.passenger_phone ?? null } : {}),
    },
    seats: num(row.seats),
    status: row.status,
    note: row.note ?? null,
    createdAt: isoRequired(row.created_at),
    updatedAt: isoRequired(row.updated_at),
  };
}

/* ------------------------------------------------------------------ */
/* Trips                                                              */
/* ------------------------------------------------------------------ */

export function mapTripParticipant(row: Record<string, any>, revealPhone = false): TripParticipant {
  return {
    id: row.user_id,
    name: row.user_name,
    role: row.role,
    seats: num(row.seats),
    shareAmount: num(row.share_amount),
    ...(revealPhone ? { phone: row.user_phone ?? null } : {}),
  };
}

export function mapTrip(
  row: Record<string, any>,
  participants: TripParticipant[],
  viewerId: string | null,
): Trip {
  const viewer = viewerId ? participants.find((p) => p.id === viewerId) ?? null : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    rideId: row.ride_id,
    driverId: row.driver_id,
    driverName: row.driver_name ?? '',
    startLocation: row.start_location,
    destination: row.destination,
    vehicleSnapshot: json(row.vehicle_snapshot, {
      id: '',
      make: '',
      model: '',
      registrationNumber: '',
      vehicleType: 'sedan',
      seatingCapacity: 0,
      color: null,
    } as RideVehicle),
    costSnapshot: json(row.cost_snapshot, {
      fuelCostPerLitre: 0,
      travelCostPerKm: 0,
      mileageKmpl: 0,
      currency: 'INR',
      costConfigurationId: null,
    }),
    distanceKm: num(row.distance_km),
    fuelConsumedLitres: num(row.fuel_consumed_litres),
    totalCost: num(row.total_cost),
    costPerKm: num(row.cost_per_km),
    currency: (row.currency ?? 'INR').trim(),
    status: row.status,
    startedAt: isoRequired(row.started_at),
    completedAt: iso(row.completed_at),
    participants,
    viewerRole: viewer?.role ?? null,
    viewerShare: viewer ? viewer.shareAmount : null,
  };
}

/* ------------------------------------------------------------------ */
/* Payments, costs, invitations, audit                                 */
/* ------------------------------------------------------------------ */

export function mapPayment(row: Record<string, any>, viewerId: string | null): Payment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    tripId: row.trip_id,
    payerId: row.payer_id,
    payerName: row.payer_name ?? '',
    receiverId: row.receiver_id,
    receiverName: row.receiver_name ?? '',
    amount: num(row.amount),
    currency: (row.currency ?? 'INR').trim(),
    status: row.status,
    direction: viewerId && row.payer_id === viewerId ? 'outgoing' : 'incoming',
    route: `${row.start_location ?? ''} → ${row.destination ?? ''}`,
    paidAt: iso(row.paid_at),
    createdAt: isoRequired(row.created_at),
  };
}

export function mapCostConfiguration(row: Record<string, any>, now = new Date()): CostConfiguration {
  const from = new Date(isoRequired(row.effective_from)).getTime();
  const until = row.effective_until ? new Date(isoRequired(row.effective_until)).getTime() : null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    value: num(row.value),
    unit: row.unit,
    currency: (row.currency ?? 'INR').trim(),
    mileageKmpl: row.mileage_kmpl === null || row.mileage_kmpl === undefined ? null : num(row.mileage_kmpl),
    effectiveFrom: isoRequired(row.effective_from),
    effectiveUntil: iso(row.effective_until),
    createdByName: row.created_by_name ?? 'System',
    createdAt: isoRequired(row.created_at),
    isCurrent: from <= now.getTime() && (until === null || until > now.getTime()),
  };
}

export function mapInvitation(row: Record<string, any>): Invitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    name: row.name,
    employeeCode: row.employee_code ?? null,
    department: row.department ?? null,
    status: row.status,
    token: row.token,
    expiresAt: isoRequired(row.expires_at),
    invitedByName: row.invited_by_name ?? 'Administrator',
    createdAt: isoRequired(row.created_at),
  };
}

export function mapAuditLog(row: Record<string, any>): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorId: row.actor_id ?? null,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? null,
    previousValues: json(row.previous_values, null as Record<string, unknown> | null),
    newValues: json(row.new_values, null as Record<string, unknown> | null),
    metadata: json(row.metadata, null as Record<string, unknown> | null),
    createdAt: isoRequired(row.created_at),
  };
}

export const readBool = bool;
