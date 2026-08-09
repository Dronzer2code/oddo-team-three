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
  /** Generated employees appended after the eight fixed ones. */
  extraEmployees?: number;
  /** Share of generated active employees that own a vehicle. */
  vehicleProbability?: number;
  /** Share of those owners that register a second household car. */
  secondVehicleProbability?: number;
  /** Gap between generated history days — 1 fills every day, 3 every third. */
  historyStepDays?: number;
  /** Rides generated per history day. Above 1, weekends are damped. */
  ridesPerDay?: number;
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

/* --------------------------------------------------------------------------
   Bulk roster
   --------------------------------------------------------------------------
   The eight employees above are addressed positionally by the test suite
   (employeeIds[0..7]) and by the demo script, so their order and statuses are
   frozen. Everyone below is generated and appended after them, which is what
   lets the organization reach a realistic headcount without moving a single
   index the tests depend on.

   Names are combined from these lists rather than written out one by one; the
   PRNG is seeded, so the roster is identical on every reseed.
   -------------------------------------------------------------------------- */

const FIRST_NAMES = [
  'Aarav',
  'Aditi',
  'Akash',
  'Ananya',
  'Arjun',
  'Bhavya',
  'Chetan',
  'Deepa',
  'Dhruv',
  'Esha',
  'Gaurav',
  'Harsh',
  'Indira',
  'Ishan',
  'Jaya',
  'Kabir',
  'Lakshmi',
  'Manav',
  'Neha',
  'Nikhil',
  'Omkar',
  'Pooja',
  'Pranav',
  'Rahul',
  'Riya',
  'Sameer',
  'Sanjana',
  'Shreya',
  'Tanvi',
  'Uday',
  'Varun',
  'Vikram',
  'Yash',
  'Zoya',
  'Aisha',
  'Rohan',
  'Sneha',
  'Kunal',
  'Divya',
  'Nitin',
];

const LAST_NAMES = [
  'Banerjee',
  'Chatterjee',
  'Das',
  'Dutta',
  'Ganguly',
  'Gupta',
  'Joshi',
  'Kapoor',
  'Khan',
  'Kulkarni',
  'Malhotra',
  'Mishra',
  'Mukherjee',
  'Nair',
  'Patel',
  'Rao',
  'Reddy',
  'Roy',
  'Saha',
  'Sen',
  'Shah',
  'Sinha',
  'Verma',
  'Bhattacharya',
  'Chakraborty',
  'Iyer',
  'Pillai',
  'Thakur',
];

const DEPARTMENTS = [
  'Engineering',
  'Design',
  'Finance',
  'Operations',
  'People Operations',
  'Sales',
  'Support',
];

/** Residential pickup areas, so search filters have variety to work with. */
const HOME_AREAS = [
  'Salt Lake Sector V',
  'New Town Action Area I',
  'Behala Chowrasta',
  'Howrah Maidan',
  'Garia Station',
  'Dumdum Cantonment',
  'Baguiati',
  'Jadavpur',
  'Tollygunge',
  'Shyambazar',
  'Rajarhat',
  'Kasba',
  'Lake Gardens',
  'Barasat',
  'Sodepur',
];

/**
 * First names already used by the fixed eight (and the admin). Searching for
 * "ananya" has to return exactly one employee, so the generator must never
 * mint a second Ananya — the admin employee search test asserts on that.
 */
const RESERVED_FIRST_NAMES = new Set(
  [...EMPLOYEES.map((e) => e.name), 'Priya Raghavan'].map((name) => name.split(' ')[0]!.toLowerCase()),
);

/** Build the generated part of the roster deterministically. */
function buildExtraEmployees(random: () => number, extraEmployeesCount: number): EmployeeSpec[] {
  const specs: EmployeeSpec[] = [];
  const usedEmails = new Set(EMPLOYEES.map((e) => e.email.toLowerCase()));

  // Drop any first name that would make a fixed employee ambiguous to search.
  const firstNames = FIRST_NAMES.filter((name) => !RESERVED_FIRST_NAMES.has(name.toLowerCase()));

  for (let i = 0; i < extraEmployeesCount; i += 1) {
    const first = firstNames[Math.floor(random() * firstNames.length)]!;
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]!;
    const name = `${first} ${last}`;

    // Email uniqueness is a case-insensitive index on users(lower(email)), so
    // a numeric suffix is appended whenever a name pair repeats.
    let email = `${first}.${last}@example.com`.toLowerCase();
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = `${first}.${last}${suffix}@example.com`.toLowerCase();
      suffix += 1;
    }
    usedEmails.add(email);

    // A realistic spread: mostly active, a few suspended, a few still pending.
    const roll = random();
    const status: AccountStatus =
      roll < 0.06 ? ACCOUNT_STATUS.SUSPENDED : roll < 0.14 ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.ACTIVE;

    const pending = status === ACCOUNT_STATUS.PENDING;

    specs.push({
      name,
      email,
      // Employee codes continue the EMP-1001.. sequence without colliding.
      phone: `+91 90000 ${String(10009 + i).slice(-5)}`,
      code: `EMP-${1009 + i}`,
      department: DEPARTMENTS[Math.floor(random() * DEPARTMENTS.length)]!,
      status,
      // Pending accounts have not completed onboarding, so no locations yet.
      home: pending ? null : HOME_AREAS[Math.floor(random() * HOME_AREAS.length)]!,
      work: pending ? null : 'Park Street Office',
    });
  }
  return specs;
}

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
  {
    ownerIndex: 0,
    make: 'Honda',
    model: 'City',
    registration: 'WB 06 AK 4412',
    type: 'sedan',
    seats: 5,
    color: 'Platinum White',
    status: VEHICLE_STATUS.ACTIVE,
  },
  {
    ownerIndex: 1,
    make: 'Maruti Suzuki',
    model: 'Baleno',
    registration: 'WB 02 BF 9087',
    type: 'hatchback',
    seats: 5,
    color: 'Nexa Blue',
    status: VEHICLE_STATUS.ACTIVE,
  },
  {
    ownerIndex: 2,
    make: 'Hyundai',
    model: 'Creta',
    registration: 'WB 20 CJ 1573',
    type: 'suv',
    seats: 5,
    color: 'Titan Grey',
    status: VEHICLE_STATUS.ACTIVE,
  },
  {
    ownerIndex: 4,
    make: 'Toyota',
    model: 'Innova Crysta',
    registration: 'WB 24 DL 6620',
    type: 'van',
    seats: 7,
    color: 'Attitude Black',
    status: VEHICLE_STATUS.ACTIVE,
  },
  {
    ownerIndex: 3,
    make: 'Tata',
    model: 'Nexon',
    registration: 'WB 18 EM 3391',
    type: 'suv',
    seats: 5,
    color: 'Calgary White',
    status: VEHICLE_STATUS.UNDER_REVIEW,
  },
  {
    ownerIndex: 5,
    make: 'Renault',
    model: 'Kwid',
    registration: 'WB 04 FN 7748',
    type: 'hatchback',
    seats: 4,
    color: 'Fiery Red',
    status: VEHICLE_STATUS.INACTIVE,
  },
];

/** Models drawn on for generated vehicles, with their body type and seats. */
const VEHICLE_MODELS: Array<{ make: string; model: string; type: VehicleType; seats: number }> = [
  { make: 'Maruti Suzuki', model: 'Swift', type: 'hatchback', seats: 5 },
  { make: 'Maruti Suzuki', model: 'Dzire', type: 'sedan', seats: 5 },
  { make: 'Maruti Suzuki', model: 'Ertiga', type: 'van', seats: 7 },
  { make: 'Hyundai', model: 'i20', type: 'hatchback', seats: 5 },
  { make: 'Hyundai', model: 'Verna', type: 'sedan', seats: 5 },
  { make: 'Hyundai', model: 'Venue', type: 'suv', seats: 5 },
  { make: 'Tata', model: 'Altroz', type: 'hatchback', seats: 5 },
  { make: 'Tata', model: 'Punch', type: 'suv', seats: 5 },
  { make: 'Honda', model: 'Amaze', type: 'sedan', seats: 5 },
  { make: 'Honda', model: 'Jazz', type: 'hatchback', seats: 5 },
  { make: 'Toyota', model: 'Glanza', type: 'hatchback', seats: 5 },
  { make: 'Toyota', model: 'Urban Cruiser', type: 'suv', seats: 5 },
  { make: 'Kia', model: 'Seltos', type: 'suv', seats: 5 },
  { make: 'Kia', model: 'Carens', type: 'van', seats: 7 },
  { make: 'Mahindra', model: 'XUV300', type: 'suv', seats: 5 },
  { make: 'Mahindra', model: 'Scorpio', type: 'suv', seats: 7 },
  { make: 'Volkswagen', model: 'Virtus', type: 'sedan', seats: 5 },
  { make: 'Skoda', model: 'Slavia', type: 'sedan', seats: 5 },
  { make: 'Renault', model: 'Triber', type: 'van', seats: 7 },
  { make: 'Nissan', model: 'Magnite', type: 'suv', seats: 5 },
];

const VEHICLE_COLORS = [
  'Pearl White',
  'Metallic Silver',
  'Midnight Black',
  'Fiery Red',
  'Ocean Blue',
  'Titan Grey',
  'Sunburst Orange',
  'Forest Green',
  'Champagne Gold',
  'Steel Blue',
];

/**
 * Registration numbers are unique per organization (case-insensitively), so
 * they are drawn from a counter rather than randomly, guaranteeing no clash.
 */
function makeRegistration(index: number): string {
  const districts = ['WB 06', 'WB 02', 'WB 20', 'WB 24', 'WB 18', 'WB 04', 'WB 12', 'WB 26'];
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const district = districts[index % districts.length]!;
  const a = letters[Math.floor(index / districts.length) % letters.length]!;
  const b = letters[Math.floor(index / (districts.length * letters.length)) % letters.length]!;
  const digits = String(1000 + ((index * 137) % 9000));
  return `${district} ${a}${b} ${digits}`;
}

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
  // Defaults deliberately describe the *small* dataset. Six test files each
  // seed a throwaway database, so every extra row here is paid for six times
  // over on every run; the demo script opts into the large numbers instead.
  const extraEmployeesCount = options.extraEmployees ?? 0;
  const vehicleProbability = options.vehicleProbability ?? 0.6;
  const secondVehicleProbability = options.secondVehicleProbability ?? 0;
  const historyStepDays = options.historyStepDays ?? 3;
  const ridesPerDay = options.ridesPerDay ?? 1;
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

    // The fixed eight keep indices 0-7 (the test suite and the demo script
    // address them positionally); the generated roster is appended after them.
    const extraEmployees = buildExtraEmployees(random, extraEmployeesCount);
    const allEmployees: EmployeeSpec[] = [...EMPLOYEES, ...extraEmployees];

    const employeeIds: string[] = [];
    for (const [index, spec] of allEmployees.entries()) {
      // Spread joining dates across the whole history window instead of
      // bunching them, so "new this month" and tenure charts look real.
      const created =
        index < EMPLOYEES.length
          ? daysAgo(historyDays + 20 - index * 3, 10, 15)
          : daysAgo(Math.floor(random() * (historyDays + 40)) + 1, 10, 15);
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
    // Fixed six first (vehicleIds[0..5] are asserted on by the tests: index 4
    // is under review and index 5 is inactive), then a generated fleet owned
    // by active employees from the bulk roster.
    const extraVehicles: VehicleSpec[] = [];
    {
      // Only active employees may own a usable vehicle, and one car each keeps
      // the "drivers" view honest.
      const eligible = allEmployees
        .map((spec, index) => ({ spec, index }))
        .filter(({ spec, index }) => index >= EMPLOYEES.length && spec.status === ACCOUNT_STATUS.ACTIVE);

      const owners = eligible.filter(() => random() < vehicleProbability);

      /** One entry in the fleet. Registration is drawn from a counter, so it
       *  is unique per organization however many cars an owner registers. */
      const addVehicle = (ownerIndex: number) => {
        const model = VEHICLE_MODELS[Math.floor(random() * VEHICLE_MODELS.length)]!;
        const roll = random();
        const status: VehicleStatus =
          roll < 0.08
            ? VEHICLE_STATUS.UNDER_REVIEW
            : roll < 0.14
              ? VEHICLE_STATUS.INACTIVE
              : VEHICLE_STATUS.ACTIVE;
        extraVehicles.push({
          ownerIndex,
          make: model.make,
          model: model.model,
          // Offset past the six hand-written registrations to avoid a clash.
          registration: makeRegistration(extraVehicles.length + VEHICLES.length + 8),
          type: model.type,
          seats: model.seats,
          color: VEHICLE_COLORS[Math.floor(random() * VEHICLE_COLORS.length)]!,
          status,
        });
      };

      for (const owner of owners) {
        addVehicle(owner.index);
        // A second household car for some owners. Only the first one is ever
        // used for driving, so this adds fleet depth without new drivers.
        if (random() < secondVehicleProbability) addVehicle(owner.index);
      }
    }

    const allVehicles: VehicleSpec[] = [...VEHICLES, ...extraVehicles];

    const vehicleIds: string[] = [];
    for (const [index, spec] of allVehicles.entries()) {
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
          // The fixed six keep their original staggered dates. Generated ones
          // are spread across the history window instead of continuing the
          // stagger, which ran past today once the fleet grew beyond ~46 cars
          // and registered vehicles in the future.
          (index < VEHICLES.length
            ? daysAgo(historyDays - index * 4, 11, 0)
            : daysAgo(Math.floor(random() * historyDays) + 1, 11, 0)
          ).toISOString(),
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
    // Drivers are everyone holding an ACTIVE vehicle whose own account is
    // active — the same rule the application enforces when publishing.
    const vehicleForDriver = new Map<number, string>([
      [0, vehicleIds[0]!],
      [1, vehicleIds[1]!],
      [2, vehicleIds[2]!],
      [4, vehicleIds[3]!],
    ]);
    for (const [index, spec] of allVehicles.entries()) {
      if (index < VEHICLES.length) continue; // fixed four already mapped above
      if (spec.status !== VEHICLE_STATUS.ACTIVE) continue;
      if (allEmployees[spec.ownerIndex]!.status !== ACCOUNT_STATUS.ACTIVE) continue;
      if (!vehicleForDriver.has(spec.ownerIndex)) {
        vehicleForDriver.set(spec.ownerIndex, vehicleIds[index]!);
      }
    }
    const driverPool = [...vehicleForDriver.keys()];

    // Anyone active can ride, including drivers riding with a colleague.
    const passengerPool = allEmployees
      .map((spec, index) => ({ spec, index }))
      .filter(({ spec }) => spec.status === ACCOUNT_STATUS.ACTIVE)
      .map(({ index }) => index);

    /** Seats a vehicle can offer — capacity minus the driver. */
    const offerableSeats = (driverIndex: number): number => {
      const vehicleId = vehicleForDriver.get(driverIndex)!;
      const spec = allVehicles[vehicleIds.indexOf(vehicleId)]!;
      return Math.max(1, spec.seats - 1);
    };

    let completedTrips = 0;
    let canceledRides = 0;

    // Every day of the window carries a few commutes, morning and evening, so
    // the trend charts and per-driver reports have real density behind them.
    for (let day = historyDays; day >= 1; day -= historyStepDays) {
      const weekday = daysAgo(day).getDay();
      // The light default keeps one ride per step. Only the dense demo dataset
      // bothers to model quiet weekends and multiple departures per day.
      const ridesToday =
        ridesPerDay <= 1
          ? 1
          : weekday === 0 || weekday === 6
            ? random() < 0.5
              ? 1
              : 0
            : ridesPerDay + Math.floor(random() * 2);

      // A driver may only publish once per departure slot, so slots are
      // handed out without repeating a driver within the same day.
      const availableDrivers = [...driverPool];

      for (let n = 0; n < ridesToday && availableDrivers.length > 0; n += 1) {
        const pick = Math.floor(random() * availableDrivers.length);
        const driverIndex = availableDrivers.splice(pick, 1)[0]!;

        const route = ROUTES[Math.floor(random() * ROUTES.length)]!;
        // Morning runs in, evening runs back out.
        const evening = random() < 0.42;
        const departure = evening
          ? daysAgo(day, 17 + Math.floor(random() * 3), random() > 0.5 ? 30 : 0)
          : daysAgo(day, 7 + Math.floor(random() * 3), random() > 0.5 ? 30 : 0);
        const basis = basisAt(departure);
        const distance = Math.round((route.km + (random() * 2 - 1)) * 10) / 10;
        const estimate = computeCost(distance, basis);

        // Never offer more seats than the vehicle actually has.
        const capacity = offerableSeats(driverIndex);
        const offeredSeats = Math.max(1, Math.min(capacity, 2 + Math.floor(random() * 3)));

        // Roughly one ride in eight is canceled and must never count as a trip.
        const canceled = random() < 0.12;

        // Candidates exclude the driver; sampled without replacement so a
        // passenger can never be added to the same ride twice (which would
        // violate ride_requests_live_unique).
        const candidates = passengerPool.filter((index) => index !== driverIndex);
        const wanted = canceled ? 0 : 1 + Math.floor(random() * Math.min(3, offeredSeats));
        const passengers: number[] = [];
        // Bounded by the candidate count, so this can never spin forever.
        for (let attempt = 0; attempt < wanted && candidates.length > 0; attempt += 1) {
          const at = Math.floor(random() * candidates.length);
          passengers.push(candidates.splice(at, 1)[0]!);
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

        // Resolve the snapshot from the vehicle actually used, not by owner —
        // a generated driver is not present in the fixed VEHICLES array.
        const usedVehicleId = vehicleForDriver.get(driverIndex)!;
        const vehicleSpec = allVehicles[vehicleIds.indexOf(usedVehicleId)]!;
        const vehicleSnapshot = {
          id: usedVehicleId,
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
    }

    /* ------------------- live, demo-ready operations ---------------- */
    // Future rides so "Find a ride" and "My rides" are never empty.
    const upcoming: Array<{
      driverIndex: number;
      route: number;
      inDays: number;
      seats: number;
      hour: number;
    }> = [
      { driverIndex: 0, route: 0, inDays: 1, seats: 3, hour: 8 },
      { driverIndex: 1, route: 1, inDays: 1, seats: 2, hour: 9 },
      { driverIndex: 2, route: 2, inDays: 2, seats: 3, hour: 8 },
      { driverIndex: 4, route: 4, inDays: 2, seats: 4, hour: 9 },
      { driverIndex: 0, route: 6, inDays: 3, seats: 2, hour: 18 },
    ];

    // Generated open rides across the coming fortnight, so "Find a ride" has
    // enough to search, filter and paginate through. Appended after the five
    // fixed entries above, whose positions the demo flow relies on.
    {
      const generatedDrivers = driverPool.filter((index) => index >= EMPLOYEES.length);
      // With no generated roster (the test fixture) this loop does nothing and
      // the five fixed upcoming rides stand alone, exactly as before.
      for (let day = 1; day <= 14 && generatedDrivers.length > 0; day += 1) {
        const perDay = 2 + Math.floor(random() * 3);
        const pool = [...generatedDrivers];
        for (let n = 0; n < perDay && pool.length > 0; n += 1) {
          const driverIndex = pool.splice(Math.floor(random() * pool.length), 1)[0]!;
          const evening = random() < 0.4;
          upcoming.push({
            driverIndex,
            route: Math.floor(random() * ROUTES.length),
            inDays: day,
            seats: Math.max(1, Math.min(offerableSeats(driverIndex), 1 + Math.floor(random() * 4))),
            hour: evening ? 17 + Math.floor(random() * 3) : 7 + Math.floor(random() * 3),
          });
        }
      }
    }

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

    // Seat requests spread across the generated open rides, so the driver
    // queues, the passenger "my rides" view and the activity feed all have
    // real rows. Only rides beyond the five fixed ones are touched.
    {
      const seatsTakenByRide = new Map<string, number>();
      for (let i = upcoming.length - 1; i >= 5; i -= 1) {
        const rideId = upcomingRideIds[i]!;
        const entry = upcoming[i]!;
        if (random() < 0.45) continue; // plenty of rides stay wide open

        // Sample distinct passengers — ride_requests_live_unique forbids two
        // live requests from the same passenger on one ride.
        const candidates = passengerPool.filter((index) => index !== entry.driverIndex);
        const wanted = Math.min(entry.seats, 1 + Math.floor(random() * 2));
        let accepted = 0;
        for (let n = 0; n < wanted && candidates.length > 0; n += 1) {
          const passengerIndex = candidates.splice(Math.floor(random() * candidates.length), 1)[0]!;
          // Accepting would exceed capacity? Leave it pending instead.
          const isAccepted = random() < 0.55 && accepted < entry.seats;
          await tx.query(
            `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, status, note, responded_by, responded_at)
             VALUES ($1::uuid, $2::uuid, $3::uuid, 1, $4::ride_request_status, $5, $6::uuid, $7::timestamptz)`,
            [
              organizationId,
              rideId,
              employeeIds[passengerIndex]!,
              isAccepted ? 'accepted' : 'pending',
              random() < 0.3 ? 'Happy to share the fuel cost.' : null,
              isAccepted ? employeeIds[entry.driverIndex]! : null,
              isAccepted ? new Date().toISOString() : null,
            ],
          );
          if (isAccepted) accepted += 1;
        }
        if (accepted > 0) seatsTakenByRide.set(rideId, accepted);
      }

      // Keep seats_taken consistent with the accepted requests — the schema
      // enforces seats_taken <= total_seats.
      for (const [rideId, taken] of seatsTakenByRide) {
        await tx.query('UPDATE rides SET seats_taken = $2::int WHERE id = $1::uuid', [rideId, taken]);
      }
    }

    // Pending invitations for the admin invitations screen. Codes continue
    // past the generated roster so users_employee_code_unique is respected.
    const invitationBase = 1009 + extraEmployeesCount;
    const invitees = [
      { name: 'Nikhil Varma', email: 'nikhil.varma@example.com', department: 'Finance' },
      { name: 'Sana Kapoor', email: 'sana.kapoor@example.com', department: 'Design' },
      { name: 'Rakesh Pillai', email: 'rakesh.pillai@example.com', department: 'Operations' },
      { name: 'Anita Desai', email: 'anita.desai@example.com', department: 'Engineering' },
      { name: 'Vivek Ranjan', email: 'vivek.ranjan@example.com', department: 'Sales' },
      { name: 'Priyanka Bose', email: 'priyanka.bose@example.com', department: 'Support' },
    ];
    for (const [index, invitee] of invitees.entries()) {
      await tx.query(
        `INSERT INTO invitations (organization_id, email, name, employee_code, department, token, invited_by, expires_at, created_at)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid,
                 NOW() + INTERVAL '14 days', $8::timestamptz)`,
        [
          organizationId,
          invitee.email,
          invitee.name,
          `EMP-${invitationBase + index}`,
          invitee.department,
          randomToken(),
          adminId,
          daysAgo(index * 2 + 1, 11, 20).toISOString(),
        ],
      );
    }

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

    // Administrative history behind the five records above, so the audit log
    // paginates and its action/entity filters have something to narrow.
    {
      const activations = allEmployees
        .map((spec, index) => ({ spec, index }))
        .filter(({ spec, index }) => index >= EMPLOYEES.length && spec.status === ACCOUNT_STATUS.ACTIVE);

      for (const { spec, index } of activations) {
        await writeAudit(tx, {
          organizationId,
          actorId: adminId,
          actorName: 'Priya Raghavan',
          action: AUDIT_ACTION.EMPLOYEE_ACTIVATED,
          entityType: 'employee',
          entityId: employeeIds[index]!,
          previousValues: { status: 'pending' },
          newValues: { status: 'active' },
          metadata: { name: spec.name },
        });
      }

      for (const { index } of allEmployees
        .map((spec, index) => ({ spec, index }))
        .filter(({ spec, index }) => index >= EMPLOYEES.length && spec.status === ACCOUNT_STATUS.SUSPENDED)) {
        await writeAudit(tx, {
          organizationId,
          actorId: adminId,
          actorName: 'Priya Raghavan',
          action: AUDIT_ACTION.EMPLOYEE_SUSPENDED,
          entityType: 'employee',
          entityId: employeeIds[index]!,
          previousValues: { status: 'active' },
          newValues: { status: 'suspended' },
          metadata: { reason: 'Access review' },
        });
      }

      // Every generated vehicle was created, and the approved ones were moved
      // out of review — both are auditable administrative actions.
      for (let index = VEHICLES.length; index < allVehicles.length; index += 1) {
        const spec = allVehicles[index]!;
        await writeAudit(tx, {
          organizationId,
          actorId: adminId,
          actorName: 'Priya Raghavan',
          action: AUDIT_ACTION.VEHICLE_CREATED,
          entityType: 'vehicle',
          entityId: vehicleIds[index]!,
          newValues: {
            make: spec.make,
            model: spec.model,
            registrationNumber: spec.registration,
            seatingCapacity: spec.seats,
          },
        });
        if (spec.status === VEHICLE_STATUS.ACTIVE) {
          await writeAudit(tx, {
            organizationId,
            actorId: adminId,
            actorName: 'Priya Raghavan',
            action: AUDIT_ACTION.VEHICLE_STATUS_CHANGED,
            entityType: 'vehicle',
            entityId: vehicleIds[index]!,
            previousValues: { status: 'under_review' },
            newValues: { status: 'active' },
          });
        }
      }
    }

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
export async function seedSecondOrganization(
  db: Database,
): Promise<{ organizationId: string; adminEmail: string }> {
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
  // Demo scale: a few hundred rows in every table, so each admin list
  // paginates and every chart has real shape behind it.
  const result = await seedDemoData(db, {
    extraEmployees: 270,
    vehicleProbability: 0.75,
    secondVehicleProbability: 0.45,
    historyDays: 185,
    historyStepDays: 1,
    ridesPerDay: 2,
  });
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
