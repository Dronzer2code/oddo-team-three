import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BOOKING_STATUS,
  BOOKING_STATUS_LABEL,
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatMoney,
  formatPlate,
} from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  Plate,
  RouteTimeline,
  Skeleton,
  resolveErrorCopy,
  useToast,
  vehicleImage,
  type BadgeTone,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { RouteMap } from '../../components/RouteMap';
import { CancelBookingDialog } from './CancelBookingDialog';

const TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  confirmed: 'success',
  rejected: 'danger',
  canceled: 'neutral',
  completed: 'ink',
};

/** One booking in full: route, driver, vehicle, seats, cost and status. */
export function BookingDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const booking = useApi(() => api.passenger.bookings.get(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (booking.error) {
    return (
      <Card>
        <ErrorState {...resolveErrorCopy(booking.error)} onRetry={booking.reload} />
      </Card>
    );
  }

  if (booking.initialLoading || !booking.data) {
    return (
      <div className="stack">
        <Skeleton variant="title" width="46%" />
        <Skeleton variant="block" height={240} />
      </div>
    );
  }

  const data = booking.data;

  return (
    <>
      <PageHeader
        title={`${data.startLocation} → ${data.destination}`}
        lead={formatDateTime(data.departureAt)}
        breadcrumbs={[{ label: 'My Bookings', href: '/passenger/bookings' }, { label: 'Booking' }]}
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
        actions={
          <>
            <Badge tone={TONE[data.status] ?? 'neutral'}>{BOOKING_STATUS_LABEL[data.status]}</Badge>
            {data.canCancel ? (
              <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
                Cancel Booking
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Your booking" />
            <CardBody className="stack">
              <RouteMap from={data.startLocation} to={data.destination} height={260} />
              <RouteTimeline from={data.startLocation} to={data.destination} />
              <DetailList
                items={[
                  { label: 'Departure', value: formatDateTime(data.departureAt) },
                  { label: 'Driver', value: data.driver.name },
                  { label: 'Vehicle', value: `${data.vehicle.make} ${data.vehicle.model}` },
                  { label: 'Seats booked', value: data.requestedSeats },
                  {
                    label: 'Estimated cost',
                    value: formatMoney(data.estimatedCost, data.currency),
                  },
                  { label: 'Status', value: BOOKING_STATUS_LABEL[data.status] },
                  { label: 'Your note', value: data.note ?? '—' },
                  { label: 'Requested', value: formatDateTime(data.createdAt) },
                ]}
              />
            </CardBody>
          </Card>

          {data.status === BOOKING_STATUS.CONFIRMED && data.tripId ? (
            <Card>
              <CardHeader title="Trip under way" lead="Your driver has started this trip." />
              <CardBody>
                <Link className="btn btn-primary btn-sm" to="/passenger/live-trip">
                  Track trip
                  <Icon name="arrowRight" size={14} />
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {data.status === BOOKING_STATUS.PENDING ? (
            <Alert tone="info">
              Waiting for {data.driver.name} to accept. You will see the seat confirmed here and in
              Notifications as soon as they respond.
            </Alert>
          ) : null}
          {data.status === BOOKING_STATUS.REJECTED ? (
            <Alert tone="warning">
              This request was declined. You can search for another ride at any time.
            </Alert>
          ) : null}
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Driver" />
            <CardBody className="stack">
              <Identity name={data.driver.name} meta={data.driver.department ?? 'Colleague'} />
              {data.driver.phone ? (
                <div className="t-caption">
                  <Icon name="phone" size={13} /> {data.driver.phone}
                </div>
              ) : (
                <p className="t-caption">Contact details appear once your seat is confirmed.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle" />
            <CardBody className="stack">
              <img
                src={vehicleImage(data.vehicle.vehicleType)}
                alt=""
                style={{ width: '100%', maxWidth: 200, alignSelf: 'center' }}
              />
              <div className="t-medium">
                {data.vehicle.make} {data.vehicle.model}
              </div>
              <Plate>{formatPlate(data.vehicle.registrationNumber)}</Plate>
              <DetailList
                items={[
                  { label: 'Type', value: VEHICLE_TYPE_LABEL[data.vehicle.vehicleType] },
                  { label: 'Seats', value: data.vehicle.seatingCapacity },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Link className="btn btn-secondary btn-sm" to={`/passenger/rides/${data.rideId}`}>
                View the ride
                <Icon name="arrowRight" size={14} />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <CancelBookingDialog
        booking={cancelOpen ? data : null}
        onClose={() => setCancelOpen(false)}
        onDone={() => {
          setCancelOpen(false);
          toast.success('Booking canceled');
          booking.reload();
        }}
      />
    </>
  );
}
