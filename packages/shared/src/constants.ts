/**
 * Domain constants shared by the backend and every frontend application.
 * Single source of truth — never re-declare these strings in an app.
 */

export const USER_ROLE = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;
export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const ACCOUNT_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
} as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

/** Statuses that may perform protected employee actions. */
export const OPERATIONAL_ACCOUNT_STATUSES: AccountStatus[] = [ACCOUNT_STATUS.ACTIVE];

export const VEHICLE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_REVIEW: 'under_review',
} as const;
export type VehicleStatus = (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

export const VEHICLE_TYPE = {
  HATCHBACK: 'hatchback',
  SEDAN: 'sedan',
  SUV: 'suv',
  VAN: 'van',
  BIKE: 'bike',
} as const;
export type VehicleType = (typeof VEHICLE_TYPE)[keyof typeof VEHICLE_TYPE];

export const RIDE_STATUS = {
  PUBLISHED: 'published',
  FULL: 'full',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
} as const;
export type RideStatus = (typeof RIDE_STATUS)[keyof typeof RIDE_STATUS];

export const RIDE_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
} as const;
export type RideRequestStatus = (typeof RIDE_REQUEST_STATUS)[keyof typeof RIDE_REQUEST_STATUS];

export const TRIP_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_ROLE = {
  DRIVER: 'driver',
  PASSENGER: 'passenger',
} as const;
export type TripRole = (typeof TRIP_ROLE)[keyof typeof TRIP_ROLE];

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SETTLED: 'settled',
  WAIVED: 'waived',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const COST_CONFIG_TYPE = {
  FUEL_PRICE: 'fuel_price',
  TRAVEL_COST: 'travel_cost',
} as const;
export type CostConfigType = (typeof COST_CONFIG_TYPE)[keyof typeof COST_CONFIG_TYPE];

export const DISTANCE_UNIT = {
  KM: 'km',
  MI: 'mi',
} as const;
export type DistanceUnit = (typeof DISTANCE_UNIT)[keyof typeof DISTANCE_UNIT];

/** Auditable actions. Keep in sync with the admin audit-log filter UI. */
export const AUDIT_ACTION = {
  EMPLOYEE_INVITED: 'employee.invited',
  EMPLOYEE_INVITE_RESENT: 'employee.invite_resent',
  EMPLOYEE_INVITE_CANCELED: 'employee.invite_canceled',
  EMPLOYEE_ACTIVATED: 'employee.activated',
  EMPLOYEE_SUSPENDED: 'employee.suspended',
  EMPLOYEE_REACTIVATED: 'employee.reactivated',
  EMPLOYEE_DEACTIVATED: 'employee.deactivated',
  EMPLOYEE_UPDATED: 'employee.updated',
  VEHICLE_CREATED: 'vehicle.created',
  VEHICLE_UPDATED: 'vehicle.updated',
  VEHICLE_STATUS_CHANGED: 'vehicle.status_changed',
  ORGANIZATION_SETTING_CHANGED: 'organization.setting_changed',
  COST_CONFIGURATION_CREATED: 'cost_configuration.created',
  COST_CONFIGURATION_CLOSED: 'cost_configuration.closed',
  ADMIN_ACCOUNT_SETTING_CHANGED: 'admin.account_setting_changed',
} as const;
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export const ERROR_CODE = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_NOT_OPERATIONAL: 'ACCOUNT_NOT_OPERATIONAL',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RULE_VIOLATION: 'RULE_VIOLATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
  deactivated: 'Deactivated',
};

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  under_review: 'Under review',
};

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  published: 'Published',
  full: 'Full',
  in_progress: 'In progress',
  completed: 'Completed',
  canceled: 'Canceled',
};

export const RIDE_REQUEST_STATUS_LABEL: Record<RideRequestStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  canceled: 'Canceled',
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  canceled: 'Canceled',
};

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
  bike: 'Bike',
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'employee.invited': 'Employee invited',
  'employee.invite_resent': 'Invitation resent',
  'employee.invite_canceled': 'Invitation canceled',
  'employee.activated': 'Employee activated',
  'employee.suspended': 'Employee suspended',
  'employee.reactivated': 'Employee reactivated',
  'employee.deactivated': 'Employee deactivated',
  'employee.updated': 'Employee updated',
  'vehicle.created': 'Vehicle created',
  'vehicle.updated': 'Vehicle updated',
  'vehicle.status_changed': 'Vehicle status changed',
  'organization.setting_changed': 'Organization setting changed',
  'cost_configuration.created': 'Cost configuration created',
  'cost_configuration.closed': 'Cost configuration closed',
  'admin.account_setting_changed': 'Admin account setting changed',
};
