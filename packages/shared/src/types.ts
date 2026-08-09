import type {
  AccountStatus,
  BookingStatus,
  CostConfigType,
  DistanceUnit,
  InvitationStatus,
  PaymentStatus,
  RideRequestStatus,
  RideStatus,
  TripRole,
  TripStatus,
  UserRole,
  VehicleStatus,
  VehicleType,
} from './constants';

/* ------------------------------------------------------------------ */
/* Transport envelope                                                  */
/* ------------------------------------------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

/* ------------------------------------------------------------------ */
/* Core entities (API representations — never raw DB rows)             */
/* ------------------------------------------------------------------ */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  distanceUnit: DistanceUnit;
  carpoolingEnabled: boolean;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface OrganizationSettings {
  organizationId: string;
  fuelCostPerLitre: number;
  travelCostPerKm: number;
  defaultMileageKmpl: number;
  vehicleApprovalRequired: boolean;
  rideApprovalRequired: boolean;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  profileComplete: boolean;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  department: string | null;
  role: UserRole;
  status: AccountStatus;
  vehicleCount: number;
  ridesPublished: number;
  tripsCompleted: number;
  isActiveParticipant: boolean;
  createdAt: string;
  lastActivityAt: string | null;
}

export interface EmployeeDetail extends EmployeeSummary {
  organizationId: string;
  organizationName: string;
  totalDistanceKm: number;
  ridesRequested: number;
  vehicles: Vehicle[];
}

export interface EmployeeProfile {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  department: string | null;
  homeLocation: string | null;
  workLocation: string | null;
  status: AccountStatus;
  profileComplete: boolean;
  currency: string;
  distanceUnit: DistanceUnit;
}

export interface Vehicle {
  id: string;
  organizationId: string;
  ownerId: string;
  ownerName: string;
  make: string;
  model: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  seatingCapacity: number;
  color: string | null;
  status: VehicleStatus;
  createdAt: string;
}

export interface VehicleDetail extends Vehicle {
  ridesPublished: number;
  tripsCompleted: number;
  totalDistanceKm: number;
  totalCost: number;
}

export interface RideDriver {
  id: string;
  name: string;
  department: string | null;
  /** Only exposed to the driver and to accepted passengers. */
  phone?: string | null;
}

export interface RideVehicle {
  id: string;
  make: string;
  model: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  seatingCapacity: number;
  color: string | null;
}

export interface Ride {
  id: string;
  organizationId: string;
  driver: RideDriver;
  vehicle: RideVehicle;
  startLocation: string;
  destination: string;
  departureAt: string;
  totalSeats: number;
  seatsTaken: number;
  seatsAvailable: number;
  estimatedDistanceKm: number;
  estimatedCost: number;
  costPerSeat: number;
  currency: string;
  notes: string | null;
  status: RideStatus;
  createdAt: string;
  /** Viewer-relative context, resolved server-side. */
  viewer: {
    isDriver: boolean;
    requestStatus: RideRequestStatus | null;
    requestId: string | null;
    canRequest: boolean;
  };
  tripId?: string | null;
  requests?: RideRequest[];
}

export interface RideRequest {
  id: string;
  rideId: string;
  passenger: {
    id: string;
    name: string;
    department: string | null;
    phone?: string | null;
  };
  seats: number;
  status: RideRequestStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The passenger-side projection of a seat request: everything the booking
 * card has to show, resolved server-side so the client never joins rides,
 * drivers and vehicles itself.
 */
export interface Booking {
  id: string;
  organizationId: string;
  rideId: string;
  passengerId: string;
  requestedSeats: number;
  status: BookingStatus;
  /** Live request state underneath the booking status. */
  requestStatus: RideRequestStatus;
  estimatedCost: number;
  currency: string;
  note: string | null;
  driver: RideDriver;
  vehicle: RideVehicle;
  startLocation: string;
  destination: string;
  departureAt: string;
  rideStatus: RideStatus;
  tripId: string | null;
  /** Server's decision — the client must not re-derive it. */
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripParticipant {
  id: string;
  name: string;
  role: TripRole;
  seats: number;
  shareAmount: number;
  phone?: string | null;
}

export interface Trip {
  id: string;
  organizationId: string;
  rideId: string;
  driverId: string;
  driverName: string;
  startLocation: string;
  destination: string;
  /** Immutable copy of the vehicle as it was when the trip started. */
  vehicleSnapshot: RideVehicle;
  /** Immutable copy of the cost configuration applied to this trip. */
  costSnapshot: {
    fuelCostPerLitre: number;
    travelCostPerKm: number;
    mileageKmpl: number;
    currency: string;
    costConfigurationId: string | null;
  };
  distanceKm: number;
  fuelConsumedLitres: number;
  totalCost: number;
  costPerKm: number;
  currency: string;
  status: TripStatus;
  startedAt: string;
  completedAt: string | null;
  participants: TripParticipant[];
  viewerRole: TripRole | null;
  viewerShare: number | null;
}

export interface Payment {
  id: string;
  organizationId: string;
  tripId: string;
  payerId: string;
  payerName: string;
  receiverId: string;
  receiverName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  direction: 'outgoing' | 'incoming';
  route: string;
  paidAt: string | null;
  createdAt: string;
}

export interface WalletSummary {
  currency: string;
  owed: number;
  receivable: number;
  settledOut: number;
  settledIn: number;
  net: number;
  payments: Payment[];
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  status: InvitationStatus;
  token: string;
  expiresAt: string;
  invitedByName: string;
  createdAt: string;
}

export interface CostConfiguration {
  id: string;
  organizationId: string;
  type: CostConfigType;
  value: number;
  unit: string;
  currency: string;
  mileageKmpl: number | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdByName: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardSummary {
  employees: { total: number; active: number; pending: number; suspended: number; newThisMonth: number };
  vehicles: { total: number; active: number; underReview: number };
  participation: { activeParticipants: number; participationRate: number };
  rides: { total: number; published: number; canceled: number };
  trips: { completed: number; inProgress: number; completedThisMonth: number };
  distance: { totalKm: number; thisMonthKm: number };
  fuel: { litres: number };
  cost: { total: number; perKm: number; currency: string };
}

export interface TrendPoint {
  period: string;
  label: string;
  trips: number;
  distanceKm: number;
  participants: number;
  cost: number;
}

export interface ParticipationReport {
  totalEmployees: number;
  activeParticipants: number;
  participationRate: number;
  publishers: number;
  requesters: number;
  completers: number;
  weekly: TrendPoint[];
  monthly: TrendPoint[];
  topParticipants: Array<{
    id: string;
    name: string;
    department: string | null;
    ridesPublished: number;
    ridesRequested: number;
    tripsCompleted: number;
    distanceKm: number;
  }>;
}

export interface ReportTotals {
  rides: number;
  completedTrips: number;
  canceledRides: number;
  canceledTrips: number;
  distanceKm: number;
  fuelLitres: number;
  totalCost: number;
  costPerKm: number;
  averageOccupancy: number;
  currency: string;
}

export interface VehicleCostRow {
  vehicleId: string;
  label: string;
  registrationNumber: string;
  trips: number;
  distanceKm: number;
  fuelLitres: number;
  cost: number;
  costPerKm: number;
  efficiencyKmpl: number;
}

export interface DriverActivityRow {
  driverId: string;
  name: string;
  department: string | null;
  ridesPublished: number;
  tripsCompleted: number;
  distanceKm: number;
  passengersServed: number;
  cost: number;
}

export interface ReportsResponse {
  totals: ReportTotals;
  monthly: TrendPoint[];
  vehicles: VehicleCostRow[];
  drivers: DriverActivityRow[];
  filters: {
    from: string;
    to: string;
    vehicleId: string | null;
    driverId: string | null;
    department: string | null;
    tripStatus: string | null;
  };
}

export interface DriverRow {
  employeeId: string;
  name: string;
  department: string | null;
  accountStatus: AccountStatus;
  vehicles: Array<{ id: string; label: string; registrationNumber: string; seatingCapacity: number; status: VehicleStatus }>;
  totalCapacity: number;
  ridesPublished: number;
  tripsCompleted: number;
  distanceKm: number;
  isActiveParticipant: boolean;
}

export interface EmployeeHomeData {
  greetingName: string;
  upcomingRides: Ride[];
  activeTrip: Trip | null;
  suggestions: Ride[];
  pendingIncomingRequests: number;
  stats: {
    ridesPublished: number;
    tripsCompleted: number;
    distanceKm: number;
    savedAmount: number;
    currency: string;
  };
  recentTrips: Trip[];
}

/* ------------------------------------------------------------------ */
/* Admin monitoring views                                              */
/* ------------------------------------------------------------------ */

/**
 * Ride as an administrator sees it: no viewer-relative state, but the
 * organization, the passenger count and the created date the admin row is
 * required to show.
 */
export interface AdminRideRow {
  id: string;
  organizationId: string;
  organizationName: string;
  driver: { id: string; name: string; department: string | null };
  vehicle: RideVehicle;
  startLocation: string;
  destination: string;
  departureAt: string;
  totalSeats: number;
  seatsTaken: number;
  seatsAvailable: number;
  passengerCount: number;
  pendingRequests: number;
  estimatedDistanceKm: number;
  estimatedCost: number;
  costPerSeat: number;
  currency: string;
  notes: string | null;
  status: RideStatus;
  tripId: string | null;
  createdAt: string;
}

export interface AdminRideDetail extends AdminRideRow {
  requests: Array<{
    id: string;
    passengerId: string;
    passengerName: string;
    passengerDepartment: string | null;
    passengerEmployeeCode: string | null;
    seats: number;
    status: RideRequestStatus;
    note: string | null;
    createdAt: string;
  }>;
  auditLogs: AuditLogEntry[];
}

export interface AdminRideRequestRow {
  id: string;
  rideId: string;
  startLocation: string;
  destination: string;
  departureAt: string;
  driverId: string;
  driverName: string;
  passengerId: string;
  passengerName: string;
  passengerEmployeeCode: string | null;
  passengerDepartment: string | null;
  seats: number;
  status: RideRequestStatus;
  note: string | null;
  createdAt: string;
}

export interface AdminTripRow {
  id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  startLocation: string;
  destination: string;
  vehicleLabel: string;
  registrationNumber: string;
  passengerCount: number;
  distanceKm: number;
  fuelConsumedLitres: number;
  totalCost: number;
  costPerKm: number;
  currency: string;
  status: TripStatus;
  startedAt: string;
  completedAt: string | null;
}

/** An employee waiting for an activation decision. */
export interface EmployeeApproval {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  department: string | null;
  status: AccountStatus;
  vehicleCount: number;
  requestedAt: string;
}

/** A vehicle waiting for a review decision, with the employee who owns it. */
export interface VehicleApproval {
  id: string;
  organizationId: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerEmployeeCode: string | null;
  ownerDepartment: string | null;
  make: string;
  model: string;
  registrationNumber: string;
  vehicleType: VehicleType;
  seatingCapacity: number;
  color: string | null;
  status: VehicleStatus;
  submittedAt: string;
}

/* ------------------------------------------------------------------ */
/* Notifications (derived — there is no notifications table in the MVP) */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | 'seat_requested'
  | 'seat_accepted'
  | 'seat_rejected'
  | 'seat_canceled'
  | 'trip_started'
  | 'trip_completed'
  | 'vehicle_approved'
  | 'vehicle_rejected'
  | 'vehicle_submitted'
  | 'employee_pending'
  | 'admin_action';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Route inside the panel that raised it, or null when there is nothing to open. */
  href: string | null;
  requiresAction: boolean;
  createdAt: string;
}
