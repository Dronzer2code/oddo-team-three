import { z } from 'zod';
import {
  ACCOUNT_STATUS,
  COST_CONFIG_TYPE,
  DISTANCE_UNIT,
  PAGINATION,
  TRIP_STATUS,
  VEHICLE_STATUS,
  VEHICLE_TYPE,
} from './constants.js';

/**
 * Validation schemas shared by client and server.
 * The server is the enforcement point; clients use these for inline feedback.
 */

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(320);
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);
export const phoneSchema = z
  .string()
  .trim()
  .min(6, 'Enter a valid phone number')
  .max(30)
  .regex(/^[+0-9()\-\s]+$/, 'Enter a valid phone number');

export const uuidSchema = z.string().uuid('Invalid identifier');

/* ---------------------------- auth ---------------------------- */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInvitationSchema = z.object({
  token: trimmed(10, 128),
  password: passwordSchema,
  name: trimmed(2, 150).optional(),
  phone: phoneSchema.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const registerSchema = z.object({
  organizationSlug: trimmed(2, 100),
  name: trimmed(2, 150),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  employeeCode: trimmed(1, 40).optional(),
  department: trimmed(1, 80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* ------------------------ employee profile -------------------- */

export const updateProfileSchema = z.object({
  name: trimmed(2, 150).optional(),
  phone: phoneSchema.optional(),
  department: trimmed(1, 80).optional(),
  employeeCode: trimmed(1, 40).optional(),
  homeLocation: trimmed(2, 200).optional(),
  workLocation: trimmed(2, 200).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* ---------------------------- vehicles ------------------------ */

export const createVehicleSchema = z.object({
  make: trimmed(1, 80),
  model: trimmed(1, 80),
  registrationNumber: trimmed(3, 30).transform((v) => v.toUpperCase()),
  vehicleType: z.nativeEnum(VEHICLE_TYPE),
  seatingCapacity: z.coerce.number().int().min(1, 'At least 1 seat').max(50),
  color: trimmed(2, 40).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const adminCreateVehicleSchema = createVehicleSchema.extend({
  ownerId: uuidSchema,
  status: z.nativeEnum(VEHICLE_STATUS).optional(),
});
export type AdminCreateVehicleInput = z.infer<typeof adminCreateVehicleSchema>;

export const adminUpdateVehicleSchema = adminCreateVehicleSchema.partial();
export type AdminUpdateVehicleInput = z.infer<typeof adminUpdateVehicleSchema>;

export const vehicleStatusSchema = z.object({
  status: z.nativeEnum(VEHICLE_STATUS),
  reason: trimmed(0, 300).optional(),
});

/* ------------------------------ rides ------------------------- */

export const publishRideSchema = z.object({
  vehicleId: uuidSchema,
  startLocation: trimmed(2, 200),
  destination: trimmed(2, 200),
  /** ISO date-time; the server re-validates that it is in the future. */
  departureAt: z.string().datetime({ offset: true }).or(z.string().min(16)),
  seats: z.coerce.number().int().min(1, 'Offer at least 1 seat').max(49),
  estimatedDistanceKm: z.coerce.number().positive('Distance must be greater than 0').max(2000),
  notes: trimmed(0, 500).optional(),
});
export type PublishRideInput = z.infer<typeof publishRideSchema>;

export const rideSearchSchema = z.object({
  from: trimmed(0, 200).optional(),
  to: trimmed(0, 200).optional(),
  date: z.string().optional(),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  minSeats: z.coerce.number().int().min(1).max(20).optional(),
  vehicleType: z.nativeEnum(VEHICLE_TYPE).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).optional(),
});
export type RideSearchInput = z.infer<typeof rideSearchSchema>;

export const requestSeatSchema = z.object({
  seats: z.coerce.number().int().min(1).max(10).default(1),
  note: trimmed(0, 300).optional(),
});
export type RequestSeatInput = z.infer<typeof requestSeatSchema>;

export const respondRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

/* ------------------------------ trips ------------------------- */

export const startTripSchema = z.object({
  rideId: uuidSchema,
});

export const completeTripSchema = z.object({
  distanceKm: z.coerce.number().positive('Distance must be greater than 0').max(2000).optional(),
});
export type CompleteTripInput = z.infer<typeof completeTripSchema>;

/* --------------------------- admin: employees ----------------- */

export const employeeListQuerySchema = z.object({
  search: trimmed(0, 120).optional(),
  status: z.nativeEnum(ACCOUNT_STATUS).optional(),
  participation: z.enum(['active', 'inactive']).optional(),
  department: trimmed(0, 80).optional(),
  sort: z.enum(['name', 'createdAt', 'lastActivityAt']).optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).optional(),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

export const employeeStatusSchema = z.object({
  status: z.enum([ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.DEACTIVATED]),
  reason: trimmed(0, 300).optional(),
});
export type EmployeeStatusInput = z.infer<typeof employeeStatusSchema>;

export const adminUpdateEmployeeSchema = z.object({
  name: trimmed(2, 150).optional(),
  phone: phoneSchema.optional(),
  department: trimmed(1, 80).optional(),
  employeeCode: trimmed(1, 40).optional(),
});
export type AdminUpdateEmployeeInput = z.infer<typeof adminUpdateEmployeeSchema>;

export const inviteEmployeeSchema = z.object({
  email: emailSchema,
  name: trimmed(2, 150),
  employeeCode: trimmed(1, 40).optional(),
  department: trimmed(1, 80).optional(),
});
export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;

export const bulkInviteSchema = z.object({
  invitations: z.array(inviteEmployeeSchema).min(1).max(100),
});

/* --------------------------- admin: organization -------------- */

export const organizationSettingsSchema = z.object({
  name: trimmed(2, 150).optional(),
  logoUrl: z.string().trim().url('Enter a valid URL').max(500).or(z.literal('')).optional(),
  contactEmail: emailSchema.or(z.literal('')).optional(),
  contactPhone: phoneSchema.or(z.literal('')).optional(),
  address: trimmed(0, 300).optional(),
  timezone: trimmed(2, 64).optional(),
  currency: trimmed(3, 3).optional(),
  distanceUnit: z.nativeEnum(DISTANCE_UNIT).optional(),
  carpoolingEnabled: z.boolean().optional(),
  vehicleApprovalRequired: z.boolean().optional(),
  rideApprovalRequired: z.boolean().optional(),
  defaultMileageKmpl: z.coerce.number().positive().max(100).optional(),
});
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

/* --------------------------- admin: costs --------------------- */

export const costConfigurationSchema = z.object({
  type: z.nativeEnum(COST_CONFIG_TYPE),
  value: z.coerce.number().positive('Value must be greater than 0').max(100000),
  unit: trimmed(1, 30),
  currency: trimmed(3, 3),
  mileageKmpl: z.coerce.number().positive().max(100).optional(),
  effectiveFrom: z.string().min(10, 'Select a start date'),
  effectiveUntil: z.string().min(10).optional().or(z.literal('')),
  note: trimmed(0, 300).optional(),
});
export type CostConfigurationInput = z.infer<typeof costConfigurationSchema>;

/* --------------------------- admin: reports ------------------- */

export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  vehicleId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  department: trimmed(0, 80).optional(),
  tripStatus: z.nativeEnum(TRIP_STATUS).optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const auditLogQuerySchema = z.object({
  action: trimmed(0, 80).optional(),
  entityType: trimmed(0, 40).optional(),
  entityId: z.string().trim().max(80).optional(),
  actorId: uuidSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).optional(),
});

export const vehicleListQuerySchema = z.object({
  search: trimmed(0, 120).optional(),
  status: z.nativeEnum(VEHICLE_STATUS).optional(),
  ownerId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).optional(),
});
export type VehicleListQuery = z.infer<typeof vehicleListQuerySchema>;

export const contactRequestSchema = z.object({
  name: trimmed(2, 150),
  email: emailSchema,
  company: trimmed(2, 150),
  employees: trimmed(1, 40).optional(),
  message: trimmed(10, 1000),
});
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
