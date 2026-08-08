import {
  ACCOUNT_STATUS_LABEL,
  PAYMENT_STATUS,
  RIDE_REQUEST_STATUS_LABEL,
  RIDE_STATUS_LABEL,
  TRIP_STATUS_LABEL,
  VEHICLE_STATUS_LABEL,
  type AccountStatus,
  type PaymentStatus,
  type RideRequestStatus,
  type RideStatus,
  type TripStatus,
  type VehicleStatus,
} from '@carpool/shared';
import { Badge, type BadgeTone } from './primitives';

/**
 * Status colour is decided in exactly one place, so an "active" employee and an
 * "active" vehicle never disagree across the admin and employee applications.
 */

const ACCOUNT_TONE: Record<AccountStatus, BadgeTone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  deactivated: 'neutral',
};

const VEHICLE_TONE: Record<VehicleStatus, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  under_review: 'warning',
};

const RIDE_TONE: Record<RideStatus, BadgeTone> = {
  published: 'accent',
  full: 'neutral',
  in_progress: 'ink',
  completed: 'success',
  canceled: 'danger',
};

const REQUEST_TONE: Record<RideRequestStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  canceled: 'neutral',
};

const TRIP_TONE: Record<TripStatus, BadgeTone> = {
  in_progress: 'ink',
  completed: 'success',
  canceled: 'danger',
};

const PAYMENT_TONE: Record<PaymentStatus, BadgeTone> = {
  pending: 'warning',
  settled: 'success',
  waived: 'neutral',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending',
  settled: 'Settled',
  waived: 'Waived',
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={ACCOUNT_TONE[status]}>{ACCOUNT_STATUS_LABEL[status]}</Badge>;
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge tone={VEHICLE_TONE[status]}>{VEHICLE_STATUS_LABEL[status]}</Badge>;
}

export function RideStatusBadge({ status }: { status: RideStatus }) {
  return <Badge tone={RIDE_TONE[status]}>{RIDE_STATUS_LABEL[status]}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RideRequestStatus }) {
  return <Badge tone={REQUEST_TONE[status]}>{RIDE_REQUEST_STATUS_LABEL[status]}</Badge>;
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge tone={TRIP_TONE[status]}>{TRIP_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status] ?? 'neutral'}>{PAYMENT_LABEL[status] ?? status}</Badge>;
}

export function ParticipationBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Participating' : 'Inactive'}</Badge>;
}

export { PAYMENT_STATUS };
