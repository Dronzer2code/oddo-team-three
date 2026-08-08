import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  ACCOUNT_STATUS,
  AUDIT_ACTION,
  COST_CONFIG_TYPE,
  VEHICLE_STATUS,
  type AccountStatus,
  type VehicleStatus,
  type VehicleType,
} from '@carpool/shared';
import { getDatabase, num, type Database, type Queryable } from './client.js';
import { runMigrations } from './migrate.js';
import { hashPassword } from '../shared/security.js';
import { computeCost, costPerSeat, splitTripCost, type CostBasis } from '../shared/cost.js';
import { writeAudit } from '../shared/audit.js';
import { randomToken } from '../shared/security.js';

/**
 * Demo data for the hackathon walkthrough.
 *
 * Everything here is obviously synthetic (example.com addresses, invented
 * names) but shaped like real usage: several months of completed trips so the
 * dashboard, participation view and reports are populated from real rows —
 * no hardcoded metrics anywhere in the applications.
 */

export const DEMO_PASSWORD = 'Password123!';

export interface SeedOptions {
  slug?: string;
  name?: string;
  /** Days of history to generate. */
  historyDays?: number;
  quiet?: boolean;
}

export interface SeedResult {
  organizationId: string;
  organizationName: string;
  slug: string;
  adminEmail: string;
  driverEmail: string;
  passengerEmail: string;
  suspendedEmail: string;
  pendingEmail: string;
  password: string;
  employeeIds: string[];
  vehicleIds: string[];
}

/** Deterministic PRNG so repeated seeds produce the same demo. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const ROUTES: Array<{ from: string; to: string; km: number }> = [
  { from: 'Salt Lake Sector V', to: 'Park Street Office', km: 12.4 },
  { from: 'New Town Action Area I', to: 'Park Street Office', km: 18.2 },
  { from: 'Behala Chowrasta', to: 'Park Street Office', km: 15.6 },
  { from: 'Howrah Maidan', to: 'Park Street Office', km: 9.8 },
  { from: 'Garia Station', to: 'Park Street Office', km: 16.9 },
  { from: 'Dumdum Cantonment', to: 'Park Street Office', km: 14.3 },
  { from: 'Park Street Office', to: 'Salt Lake Sector V', km: 12.4 },
  { from: 'Park Street Office', to: 'New Town Action Area I', km: 18.2 },
];

interface EmployeeSpec {
  name: string;
  email: string;
  phone: string;
  code: string;
  department: string;
  status: AccountStatus;
  home: string | null;
  work: string | null;
}

const EMPLOYEES: EmployeeSpec[] = [
  {
    name: 'Ananya Bose',
    email: 'ananya.bose@example.com',
    phone: '+91 90000 10001',
    code: 'EMP-1001',
    department: 'Engineering',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'Salt Lake Sector V',
    work: 'Park Street Office',
  },
  {
    name: 'Rohit Menon',
    email: 'rohit.menon@example.com',
    phone: '+91 90000 10002',
    code: 'EMP-1002',
    department: 'Engineering',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'New Town Action Area I',
    work: 'Park Street Office',
  },
  {
    name: 'Farhan Qureshi',
    email: 'farhan.qureshi@example.com',
    phone: '+91 90000 10003',
    code: 'EMP-1003',
    department: 'Design',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'Behala Chowrasta',
    work: 'Park Street Office',
  },
  {
    name: 'Meera Iyer',
    email: 'meera.iyer@example.com',
    phone: '+91 90000 10004',
    code: 'EMP-1004',
    department: 'Finance',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'Howrah Maidan',
    work: 'Park Street Office',
  },
  {
    name: 'Dev Sharma',
    email: 'dev.sharma@example.com',
    phone: '+91 90000 10005',
    code: 'EMP-1005',
    department: 'Operations',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'Garia Station',
    work: 'Park Street Office',
  },
  {
    name: 'Kavya Nair',
    email: 'kavya.nair@example.com',
    phone: '+91 90000 10006',
    code: 'EMP-1006',
    department: 'Design',
    status: ACCOUNT_STATUS.ACTIVE,
    home: 'Dumdum Cantonment',
    work: 'Park Street Office',
  },
  {
    name: 'Imran Sheikh',
    email: 'imran.sheikh@example.com',
    phone: '+91 90000 10007',
    code: 'EMP-1007',
    department: 'Operations',
    status: ACCOUNT_STATUS.SUSPENDED,
    home: 'Baguiati',
    work: 'Park Street Office',
  },
  {
    name: 'Trisha Ghosh',
    email: 'trisha.ghosh@example.com',
    phone: '+91 90000 10008',
    code: 'EMP-1008',
    department: 'Engineering',
    status: ACCOUNT_STATUS.PENDING,
    home: null,
    work: null,
  },
];

interface VehicleSpec {
  ownerIndex: number;
  make: string;
  model: string;
  registration: string;
  type: VehicleType;
  seats: number;
  color: string;
  status: VehicleStatus;
}

const VEHICLES: VehicleSpec[] = [
  { ownerIndex: 0, make: 'Honda', model: 'City', registration: 'WB 06 AK 4412', type: 'sedan', seats: 5, color: 'Platinum White', status: VEHICLE_STATUS.ACTIVE },
  { ownerIndex: 1, make: 'Maruti Suzuki', model: 'Baleno', registration: 'WB 02 BF 9087', type: 'hatchback', seats: 5, color: 'Nexa Blue', status: VEHICLE_STATUS.ACTIVE },
  { ownerIndex: 2, make: 'Hyundai', model: 'Creta', registration: 'WB 20 CJ 1573', type: 'suv', seats: 5, color: 'Titan Grey', status: VEHICLE_STATUS.ACTIVE },
  { ownerIndex: 4, make: 'Toyota', model: 'Innova Crysta', registration: 'WB 24 DL 6620', type: 'van', seats: 7, color: 'Attitude Black', status: VEHICLE_STATUS.ACTIVE },
  { ownerIndex: 3, make: 'Tata', model: 'Nexon', registration: 'WB 18 EM 3391', type: 'suv', seats: 5, color: 'Calgary White', status: VEHICLE_STATUS.UNDER_REVIEW },
  { ownerIndex: 5, make: 'Renault', model: 'Kwid', registration: 'WB 04 FN 7748', type: 'hatchback', seats: 4, color: 'Fiery Red', status: VEHICLE_STATUS.INACTIVE },
];

function daysAgo(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAhead(days: number, hour = 8, minute = 30): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function insertCostVersion(
  db: Queryable,
  organizationId: string,
  createdBy: string,
  version: {
    type: 'fuel_price' | 'travel_cost';
    value: number;
    unit: string;
    mileage?: number | null;
    from: Date;
    until: Date | null;
    note: string;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO cost_configurations
       (organization_id, type, value, unit, currency, mileage_kmpl, effective_from, effective_until, note, created_by)
     VALUES ($1::uuid, $2::cost_config_type, $3::numeric, $4, 'INR', $5::numeric,
             $6::timestamptz, $7::timestamptz, $8, $9::uuid)
     RETURNING id`,
    [
      organizationId,
      version.type,
      version.value,
      version.unit,
      version.mileage ?? null,
      version.from.toISOString(),
      version.until ? version.until.toISOString() : null,
      version.note,
      createdBy,
    ],
  );
  return rows[0]!.id;
}

export async function seedDemoData(db: Database, options: SeedOptions = {}): Promise<SeedResult> {
  const slug = options.slug ?? 'northwind-logistics';
  const name = options.name ?? 'Northwind Logistics';
  const historyDays = options.historyDays ?? 150;
  const random = makeRandom(20260808);
  const log = (message: string) => {
    if (!options.quiet) console.log(message);
  };

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return db.transaction(async (tx) => {
    /* ------------------------- organization ------------------------- */
    const orgResult = await tx.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, logo_url, contact_email, contact_phone, address,
                                  timezone, currency, distance_unit, carpooling_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, 'Asia/Kolkata', 'INR', 'km'::distance_unit, TRUE)
       RETURNING id`,
      [
        name,
        slug,
        'https://images.unsplash.com/photo-1549194388-f61be84a6e9e?auto=format&fit=crop&w=128&h=128&q=80',
        'mobility@northwind.example.com',
        '+91 33 4000 1200',
        '14 Park Street, Kolkata 700016',
      ],
    );
    const organizationId = orgResult.rows[0]!.id;

    await tx.query(
      `INSERT INTO org_settings (organization_id, fuel_cost_per_litre, travel_cost_per_km,
                                 default_mileage_kmpl, vehicle_approval_required, ride_approval_required)
       VALUES ($1::uuid, 104.50, 2.20, 15.50, TRUE, TRUE)`,
      [organizationId],
    );

    /* ---------------------------- people ---------------------------- */
    const adminResult = await tx.query<{ id: string }>(
      `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status,
                          employee_code, department, home_location, work_location, last_activity_at)
       VALUES ($1::uuid, 'Priya Raghavan', 'admin@northwind.example.com', '+91 90000 90000', $2,
               'admin'::user_role, 'active'::account_status, 'ADM-0001', 'People Operations',
               'Ballygunge', 'Park Street Office', NOW())
       RETURNING id`,
      [organizationId, passwordHash],
    );
    const adminId = adminResult.rows[0]!.id;

    const employeeIds: string[] = [];
    for (const [index, spec] of EMPLOYEES.entries()) {
      const created = daysAgo(historyDays + 20 - index * 3, 10, 15);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status,
                            employee_code, department, home_location, work_location,
                            created_at, last_activity_at)
         VALUES ($1::uuid, $2, $3, $4, $5, 'employee'::user_role, $6::account_status,
                 $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
         RETURNING id`,
        [
          organizationId,
          spec.name,
          spec.email,
          spec.phone,
          passwordHash,
          spec.status,
          spec.code,
          spec.department,
          spec.home,
          spec.work,
          created.toISOString(),
          spec.status === ACCOUNT_STATUS.PENDING ? null : daysAgo(random() * 6, 18, 40).toISOString(),
        ],
      );
      employeeIds.push(rows[0]!.id);
    }

    /* --------------------------- vehicles --------------------------- */
    const vehicleIds: string[] = [];
    for (const [index, spec] of VEHICLES.entries()) {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO vehicles (organization_id, owner_id, make, model, registration_number,
                               vehicle_type, color, seating_capacity, status, created_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::vehicle_type, $7, $8::int, $9::vehicle_status, $10::timestamptz)
         RETURNING id`,
        [
          organizationId,
          employeeIds[spec.ownerIndex]!,
          spec.make,
          spec.model,
          spec.registration,
          spec.type,
          spec.color,
          spec.seats,
          spec.status,
          daysAgo(historyDays - index * 4, 11, 0).toISOString(),
        ],
      );
      vehicleIds.push(rows[0]!.id);
    }

    /* ----------------------- cost versions -------------------------- */
    // Three fuel-price versions and two travel-cost versions, so historical
    // trips demonstrably use the rate that was in force at the time.
    const fuelV1From = daysAgo(historyDays + 10);
    const fuelV2From = daysAgo(90);
    const fuelV3From = daysAgo(30);

    await insertCostVersion(tx, organizationId, adminId, {
      type: COST_CONFIG_TYPE.FUEL_PRICE,
      value: 96.4,
      unit: 'per litre',
      mileage: 14.5,
      from: fuelV1From,
      until: fuelV2From,
      note: 'Opening fuel benchmark',
    });
    await insertCostVersion(tx, organizationId, adminId, {
      type: COST_CONFIG_TYPE.FUEL_PRICE,
      value: 101.2,
      unit: 'per litre',
      mileage: 15.0,
      from: fuelV2From,
      until: fuelV3From,
      note: 'Q2 revision',
    });
    const currentFuelId = await insertCostVersion(tx, organizationId, adminId, {
      type: COST_CONFIG_TYPE.FUEL_PRICE,
      value: 104.5,
      unit: 'per litre',
      mileage: 15.5,
      from: fuelV3From,
      until: null,
      note: 'Current pump price',
    });

    await insertCostVersion(tx, organizationId, adminId, {
      type: COST_CONFIG_TYPE.TRAVEL_COST,
      value: 1.8,
      unit: 'per km',
      from: fuelV1From,
      until: fuelV3From,
      note: 'Running cost allowance',
    });
    await insertCostVersion(tx, organizationId, adminId, {
      type: COST_CONFIG_TYPE.TRAVEL_COST,
      value: 2.2,
      unit: 'per km',
      from: fuelV3From,
      until: null,
      note: 'Revised running cost allowance',
    });

    /** The basis that was effective on a given date. */
    const basisAt = (when: Date): CostBasis => {
      const t = when.getTime();
      const fuel =
        t >= fuelV3From.getTime()
          ? { value: 104.5, mileage: 15.5, id: currentFuelId }
          : t >= fuelV2From.getTime()
            ? { value: 101.2, mileage: 15.0, id: null }
            : { value: 96.4, mileage: 14.5, id: null };
      const travel = t >= fuelV3From.getTime() ? 2.2 : 1.8;
      return {
        fuelCostPerLitre: fuel.value,
        travelCostPerKm: travel,
        mileageKmpl: fuel.mileage,
        currency: 'INR',
        costConfigurationId: fuel.id,
      };
    };

    /* --------------------- historical operations -------------------- */
    const driverPool = [0, 1, 2, 4]; // employees who own active vehicles
    const vehicleForDriver = new Map<number, string>([
      [0, vehicleIds[0]!],
      [1, vehicleIds[1]!],
      [2, vehicleIds[2]!],
      [4, vehicleIds[3]!],
    ]);
    const passengerPool = [3, 5, 1, 2, 0, 4];

    let completedTrips = 0;
    let canceledRides = 0;

    for (let day = historyDays; day >= 3; day -= 3) {
      const driverIndex = driverPool[Math.floor(random() * driverPool.length)]!;
      const route = ROUTES[Math.floor(random() * ROUTES.length)]!;
      const departure = daysAgo(day, 8 + Math.floor(random() * 2), random() > 0.5 ? 30 : 0);
      const basis = basisAt(departure);
      const distance = Math.round((route.km + (random() * 2 - 1)) * 10) / 10;
      const estimate = computeCost(distance, basis);
      const offeredSeats = 2 + Math.floor(random() * 2);

      // Roughly one ride in eight is canceled and must never count as a trip.
      const canceled = random() < 0.12;

      const passengerCount = canceled ? 0 : 1 + Math.floor(random() * Math.min(2, offeredSeats));
      const passengers: number[] = [];
      while (passengers.length < passengerCount) {
        const candidate = passengerPool[Math.floor(random() * passengerPool.length)]!;
        if (candidate !== driverIndex && !passengers.includes(candidate)) passengers.push(candidate);
      }

      const rideResult = await tx.query<{ id: string }>(
        `INSERT INTO rides (organization_id, driver_id, vehicle_id, start_location, destination,
                            departure_at, total_seats, seats_taken, estimated_distance_km,
                            estimated_cost, cost_per_seat, currency, notes, status, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::timestamptz, $7::int, $8::int,
                 $9::numeric, $10::numeric, $11::numeric, 'INR', $12, $13::ride_status, $14::timestamptz)
         RETURNING id`,
        [
          organizationId,
          employeeIds[driverIndex]!,
          vehicleForDriver.get(driverIndex)!,
          route.from,
          route.to,
          departure.toISOString(),
          offeredSeats,
          passengers.length,
          distance,
          estimate.totalCost,
          costPerSeat(estimate.totalCost, offeredSeats),
          random() > 0.7 ? 'Leaving from the main gate.' : null,
          canceled ? 'canceled' : 'completed',
          new Date(departure.getTime() - 36 * 60 * 60 * 1000).toISOString(),
        ],
      );
      const rideId = rideResult.rows[0]!.id;

      for (const passengerIndex of passengers) {
        await tx.query(
          `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, status, responded_by, responded_at, created_at)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 1, $4::ride_request_status, $5::uuid, $6::timestamptz, $7::timestamptz)`,
          [
            organizationId,
            rideId,
            employeeIds[passengerIndex]!,
            canceled ? 'canceled' : 'accepted',
            employeeIds[driverIndex]!,
            new Date(departure.getTime() - 20 * 60 * 60 * 1000).toISOString(),
            new Date(departure.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          ],
        );
      }

      if (canceled) {
        canceledRides += 1;
        continue;
      }

      const completedAt = new Date(departure.getTime() + 45 * 60 * 1000);
      const actual = computeCost(distance, basis);
      const split = splitTripCost(
        actual.totalCost,
        passengers.map((p) => ({ userId: employeeIds[p]!, seats: 1 })),
      );

      const vehicleSpec = VEHICLES.find((v) => v.ownerIndex === driverIndex)!;
      const vehicleSnapshot = {
        id: vehicleForDriver.get(driverIndex)!,
        make: vehicleSpec.make,
        model: vehicleSpec.model,
        registrationNumber: vehicleSpec.registration,
        vehicleType: vehicleSpec.type,
        seatingCapacity: vehicleSpec.seats,
        color: vehicleSpec.color,
      };
      const costSnapshot = {
        fuelCostPerLitre: basis.fuelCostPerLitre,
        travelCostPerKm: basis.travelCostPerKm,
        mileageKmpl: basis.mileageKmpl,
        currency: 'INR',
        costConfigurationId: basis.costConfigurationId,
      };

      const tripResult = await tx.query<{ id: string }>(
        `INSERT INTO trips (organization_id, ride_id, driver_id, start_location, destination,
                            vehicle_snapshot, cost_snapshot, cost_configuration_id,
                            distance_km, fuel_consumed_litres, total_cost, cost_per_km,
                            currency, status, started_at, completed_at, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7::jsonb, $8::uuid,
                 $9::numeric, $10::numeric, $11::numeric, $12::numeric, 'INR',
                 'completed'::trip_status, $13::timestamptz, $14::timestamptz, $13::timestamptz)
         RETURNING id`,
        [
          organizationId,
          rideId,
          employeeIds[driverIndex]!,
          route.from,
          route.to,
          JSON.stringify(vehicleSnapshot),
          JSON.stringify(costSnapshot),
          basis.costConfigurationId,
          distance,
          actual.fuelLitres,
          actual.totalCost,
          actual.costPerKm,
          departure.toISOString(),
          completedAt.toISOString(),
        ],
      );
      const tripId = tripResult.rows[0]!.id;
      completedTrips += 1;

      await tx.query(
        `INSERT INTO trip_participants (organization_id, trip_id, user_id, role, seats, share_amount, created_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'driver'::trip_role, 1, $4::numeric, $5::timestamptz)`,
        [organizationId, tripId, employeeIds[driverIndex]!, split.driverShare, departure.toISOString()],
      );

      for (const share of split.passengerShares) {
        await tx.query(
          `INSERT INTO trip_participants (organization_id, trip_id, user_id, role, seats, share_amount, created_at)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'passenger'::trip_role, $4::int, $5::numeric, $6::timestamptz)`,
          [organizationId, tripId, share.userId, share.seats, share.amount, departure.toISOString()],
        );
        const settled = day > 20;
        await tx.query(
          `INSERT INTO payments (organization_id, trip_id, payer_id, receiver_id, amount, currency, status, paid_at, created_at)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, 'INR', $6::payment_status, $7::timestamptz, $8::timestamptz)`,
          [
            organizationId,
            tripId,
            share.userId,
            employeeIds[driverIndex]!,
            share.amount,
            settled ? 'settled' : 'pending',
            settled ? completedAt.toISOString() : null,
            completedAt.toISOString(),
          ],
        );
      }
    }

    /* ------------------- live, demo-ready operations ---------------- */
    // Future rides so "Find a ride" and "My rides" are never empty.
    const upcoming: Array<{ driverIndex: number; route: number; inDays: number; seats: number; hour: number }> = [
      { driverIndex: 0, route: 0, inDays: 1, seats: 3, hour: 8 },
      { driverIndex: 1, route: 1, inDays: 1, seats: 2, hour: 9 },
      { driverIndex: 2, route: 2, inDays: 2, seats: 3, hour: 8 },
      { driverIndex: 4, route: 4, inDays: 2, seats: 4, hour: 9 },
      { driverIndex: 0, route: 6, inDays: 3, seats: 2, hour: 18 },
    ];

    const upcomingRideIds: string[] = [];
    for (const entry of upcoming) {
      const route = ROUTES[entry.route]!;
      const departure = daysAhead(entry.inDays, entry.hour, 30);
      const basis = basisAt(departure);
      const estimate = computeCost(route.km, basis);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO rides (organization_id, driver_id, vehicle_id, start_location, destination,
                            departure_at, total_seats, seats_taken, estimated_distance_km,
                            estimated_cost, cost_per_seat, currency, notes, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::timestamptz, $7::int, 0,
                 $8::numeric, $9::numeric, $10::numeric, 'INR', $11, 'published'::ride_status)
         RETURNING id`,
        [
          organizationId,
          employeeIds[entry.driverIndex]!,
          vehicleForDriver.get(entry.driverIndex)!,
          route.from,
          route.to,
          departure.toISOString(),
          entry.seats,
          route.km,
          estimate.totalCost,
          costPerSeat(estimate.totalCost, entry.seats),
          entry.hour > 12 ? 'Evening drop, leaving sharp.' : 'Pickup near the metro gate.',
        ],
      );
      upcomingRideIds.push(rows[0]!.id);
    }

    // One accepted passenger (upcoming ride shows on both sides) …
    await tx.query(
      `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, status, note, responded_by, responded_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'accepted'::ride_request_status,
               'Can you stop at the crossing?', $4::uuid, NOW())`,
      [organizationId, upcomingRideIds[0]!, employeeIds[3]!, employeeIds[0]!],
    );
    await tx.query('UPDATE rides SET seats_taken = 1 WHERE id = $1::uuid', [upcomingRideIds[0]!]);

    // … and two pending requests so the driver has something to decide on.
    await tx.query(
      `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, status, note)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'pending'::ride_request_status, 'Happy to share fuel cost.')`,
      [organizationId, upcomingRideIds[0]!, employeeIds[5]!],
    );
    await tx.query(
      `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 'pending'::ride_request_status)`,
      [organizationId, upcomingRideIds[2]!, employeeIds[3]!],
    );

    // A pending invitation for the admin invitations screen.
    await tx.query(
      `INSERT INTO invitations (organization_id, email, name, employee_code, department, token, invited_by, expires_at)
       VALUES ($1::uuid, 'nikhil.varma@example.com', 'Nikhil Varma', 'EMP-1009', 'Finance', $2, $3::uuid,
               NOW() + INTERVAL '14 days')`,
      [organizationId, randomToken(), adminId],
    );

    /* ------------------------- audit trail -------------------------- */
    await writeAudit(tx, {
      organizationId,
      actorId: adminId,
      actorName: 'Priya Raghavan',
      action: AUDIT_ACTION.ORGANIZATION_SETTING_CHANGED,
      entityType: 'organization',
      entityId: organizationId,
      previousValues: { vehicleApprovalRequired: false },
      newValues: { vehicleApprovalRequired: true },
    });
    await writeAudit(tx, {
      organizationId,
      actorId: adminId,
      actorName: 'Priya Raghavan',
      action: AUDIT_ACTION.COST_CONFIGURATION_CREATED,
      entityType: 'cost_configuration',
      entityId: currentFuelId,
      newValues: { type: 'fuel_price', value: 104.5, unit: 'per litre', mileageKmpl: 15.5 },
    });
    await writeAudit(tx, {
      organizationId,
      actorId: adminId,
      actorName: 'Priya Raghavan',
      action: AUDIT_ACTION.VEHICLE_STATUS_CHANGED,
      entityType: 'vehicle',
      entityId: vehicleIds[2]!,
      previousValues: { status: 'under_review' },
      newValues: { status: 'active' },
      metadata: { via: 'admin' },
    });
    await writeAudit(tx, {
      organizationId,
      actorId: adminId,
      actorName: 'Priya Raghavan',
      action: AUDIT_ACTION.EMPLOYEE_SUSPENDED,
      entityType: 'employee',
      entityId: employeeIds[6]!,
      previousValues: { status: 'active' },
      newValues: { status: 'suspended' },
      metadata: { reason: 'Vehicle documents pending verification' },
    });
    await writeAudit(tx, {
      organizationId,
      actorId: adminId,
      actorName: 'Priya Raghavan',
      action: AUDIT_ACTION.EMPLOYEE_ACTIVATED,
      entityType: 'employee',
      entityId: employeeIds[0]!,
      previousValues: { status: 'pending' },
      newValues: { status: 'active' },
    });

    const counts = await tx.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid) AS users,
         (SELECT COUNT(*) FROM vehicles WHERE organization_id = $1::uuid) AS vehicles,
         (SELECT COUNT(*) FROM rides WHERE organization_id = $1::uuid) AS rides,
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid) AS trips,
         (SELECT COUNT(*) FROM payments WHERE organization_id = $1::uuid) AS payments,
         (SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1::uuid) AS audit`,
      [organizationId],
    );
    const c = counts.rows[0] ?? {};
    log(
      `  ${name}: ${num(c.users)} users, ${num(c.vehicles)} vehicles, ${num(c.rides)} rides ` +
        `(${completedTrips} completed trips, ${canceledRides} canceled rides), ` +
        `${num(c.payments)} payments, ${num(c.audit)} audit records`,
    );

    return {
      organizationId,
      organizationName: name,
      slug,
      adminEmail: 'admin@northwind.example.com',
      driverEmail: EMPLOYEES[0]!.email,
      passengerEmail: EMPLOYEES[3]!.email,
      suspendedEmail: EMPLOYEES[6]!.email,
      pendingEmail: EMPLOYEES[7]!.email,
      password: DEMO_PASSWORD,
      employeeIds,
      vehicleIds,
    };
  });
}

/** Second organization — proves isolation in the UI as well as in tests. */
export async function seedSecondOrganization(db: Database): Promise<{ organizationId: string; adminEmail: string }> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return db.transaction(async (tx) => {
    const org = await tx.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, contact_email, currency)
       VALUES ('Fairwind Retail', 'fairwind-retail', 'ops@fairwind.example.com', 'INR') RETURNING id`,
      [],
    );
    const organizationId = org.rows[0]!.id;
    await tx.query(
      `INSERT INTO org_settings (organization_id, fuel_cost_per_litre, travel_cost_per_km, default_mileage_kmpl)
       VALUES ($1::uuid, 102.00, 2.00, 14.00)`,
      [organizationId],
    );
    await tx.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role, status, employee_code, department)
       VALUES ($1::uuid, 'Sandeep Rao', 'admin@fairwind.example.com', $2, 'admin'::user_role,
               'active'::account_status, 'ADM-0001', 'Operations')`,
      [organizationId, passwordHash],
    );
    await tx.query(
      `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status, employee_code, department, home_location, work_location)
       VALUES ($1::uuid, 'Leela Krishnan', 'leela.krishnan@example.com', '+91 90000 20001', $2,
               'employee'::user_role, 'active'::account_status, 'EMP-2001', 'Retail',
               'Jadavpur', 'Camac Street Store')`,
      [organizationId, passwordHash],
    );
    return { organizationId, adminEmail: 'admin@fairwind.example.com' };
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const db = await getDatabase();
  await runMigrations(db);

  const existing = await db.query<{ total: unknown }>('SELECT COUNT(*) AS total FROM organizations');
  if (num(existing.rows[0]?.total) > 0) {
    console.log('Database already contains organizations — run `npm run db:reset` first to reseed.');
    await db.close();
    process.exit(0);
  }

  console.log('RideSync — seeding demo data');
  const result = await seedDemoData(db);
  await seedSecondOrganization(db);

  console.log('\nDemo accounts (password for all: %s)', result.password);
  console.log('  Administrator   %s', result.adminEmail);
  console.log('  Driver          %s', result.driverEmail);
  console.log('  Passenger       %s', result.passengerEmail);
  console.log('  Suspended       %s', result.suspendedEmail);
  console.log('  Pending         %s', result.pendingEmail);
  console.log('  Other org admin admin@fairwind.example.com');
  console.log('\nOrganization code for self-registration: %s', result.slug);

  await db.close();
  process.exit(0);
}
