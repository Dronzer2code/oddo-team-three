import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatDistance,
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
  ConfirmDialog,
  DetailList,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  Plate,
  RequestStatusBadge,
  RideStatusBadge,
  RouteTimeline,
  Seats,
  Skeleton,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { RouteMap } from '../../components/RouteMap';

/**
 * A ride, seen by the driver who published it. Everything here is a driver
 * action — this page has no equivalent in the passenger panel and must not be
 * reachable from it.
 */
export function DriverRideDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const ride = useApi(() => api.employee.rides.get(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  const cancelRide = useMutation((rideId: string) => api.employee.rides.cancel(rideId));
  const startTrip = useMutation((rideId: string) => api.employee.trips.start(rideId));

  if (ride.error) {
    return (
      <Card>
        <ErrorState {...resolveErrorCopy(ride.error)} onRetry={ride.reload} />
      </Card>
    );
  }

  if (ride.initialLoading || !ride.data) {
    return (
      <div className="stack">
        <Skeleton variant="title" width="46%" />
        <Skeleton variant="block" height={260} />
      </div>
    );
  }

  const data = ride.data;

  // Defence in depth: the API already refuses driver actions from a non-driver,
  // but the page should not present them either.
  if (!data.viewer.isDriver) {
    return (
      <Card>
        <EmptyState
          icon="shield"
          title="This is not your ride"
          text="Only the driver who published a ride can manage it."
          action={
            <Link className="btn btn-primary" to={`/passenger/rides/${data.id}`}>
              Open it as a passenger
            </Link>
          }
        />
      </Card>
    );
  }

  const upcoming = data.status === 'published' || data.status === 'full';
  const requests = data.requests ?? [];
  const pending = requests.filter((request) => request.status === 'pending');

  return (
    <>
      <PageHeader
        title={`${data.startLocation} → ${data.destination}`}
        lead={formatDateTime(data.departureAt)}
        breadcrumbs={[{ label: 'My Rides', href: '/driver/rides' }, { label: 'Ride details' }]}
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
        actions={
          <>
            <Badge tone="ink">You are driving</Badge>
            <RideStatusBadge status={data.status} />
            {upcoming ? (
              <>
                <Button variant="primary" icon="play" onClick={() => setStartOpen(true)}>
                  Start Trip
                </Button>
                <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
                  Cancel Ride
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" />
            <CardBody className="stack">
              <RouteMap from={data.startLocation} to={data.destination} height={280} />
              <RouteTimeline from={data.startLocation} to={data.destination} />
              <DetailList
                items={[
                  { label: 'Departure', value: formatDateTime(data.departureAt) },
                  { label: 'Estimated distance', value: formatDistance(data.estimatedDistanceKm) },
                  { label: 'Estimated cost', value: formatMoney(data.estimatedCost, data.currency) },
                  { label: 'Cost per seat', value: formatMoney(data.costPerSeat, data.currency) },
                  {
                    label: 'Available seats',
                    value: (
                      <span className="row" style={{ gap: 'var(--space-2)' }}>
                        <Seats total={data.totalSeats} taken={data.seatsTaken} />
                        {data.seatsAvailable} of {data.totalSeats}
                      </span>
                    ),
                  },
                  { label: 'Your notes', value: data.notes ?? '—' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Passenger requests"
              lead={`${pending.length} waiting · ${requests.length} in total`}
              actions={
                <Link className="btn btn-primary btn-sm" to={`/driver/rides/${data.id}/requests`}>
                  Manage Requests
                  <Icon name="arrowRight" size={14} />
                </Link>
              }
            />
            <CardBody flush>
              {requests.length === 0 ? (
                <EmptyState
                  icon="seat"
                  title="No requests yet"
                  text="Colleagues can request a seat until the ride departs."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {requests.map((request) => (
                        <tr key={request.id}>
                          <td>
                            <Identity
                              name={request.passenger.name}
                              meta={request.passenger.department ?? 'Colleague'}
                              size="sm"
                            />
                          </td>
                          <td className="t-caption">
                            {request.seats} seat{request.seats === 1 ? '' : 's'}
                          </td>
                          <td>
                            <RequestStatusBadge status={request.status} />
                          </td>
                          <td className="t-caption t-nowrap t-right">{formatDateTime(request.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Vehicle" />
            <CardBody className="stack">
              <div className="t-medium">
                {data.vehicle.make} {data.vehicle.model}
              </div>
              <Plate>{formatPlate(data.vehicle.registrationNumber)}</Plate>
              <DetailList
                items={[
                  { label: 'Type', value: VEHICLE_TYPE_LABEL[data.vehicle.vehicleType] },
                  { label: 'Capacity', value: data.vehicle.seatingCapacity },
                  { label: 'Color', value: data.vehicle.color ?? '—' },
                ]}
              />
              <Link className="btn btn-secondary btn-sm" to="/driver/vehicle">
                My Vehicle
                <Icon name="arrowRight" size={14} />
              </Link>
            </CardBody>
          </Card>

          {data.tripId ? (
            <Card>
              <CardHeader title="Trip" lead="This ride has been started." />
              <CardBody>
                <Link className="btn btn-primary btn-sm" to="/driver/active-trip">
                  Active Trip
                  <Icon name="arrowRight" size={14} />
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Ride"
        message="Everyone holding or waiting on a seat loses it. This cannot be undone."
        confirmLabel="Cancel Ride"
        cancelLabel="Keep the ride"
        tone="danger"
        busy={cancelRide.busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          const result = await cancelRide.run(data.id);
          if (result) {
            toast.success('Ride canceled');
            setCancelOpen(false);
            ride.reload();
          } else if (cancelRide.error) {
            toast.error(cancelRide.error.message);
          }
        }}
      >
        {cancelRide.error ? <Alert tone="error">{cancelRide.error.message}</Alert> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={startOpen}
        title="Start Trip"
        message="Accepted passengers are added to the trip, and the vehicle and cost basis are frozen onto it."
        confirmLabel="Start Trip"
        cancelLabel="Not yet"
        busy={startTrip.busy}
        onCancel={() => setStartOpen(false)}
        onConfirm={async () => {
          const result = await startTrip.run(data.id);
          if (result) {
            toast.success('Trip started');
            setStartOpen(false);
            navigate('/driver/active-trip');
          } else if (startTrip.error) {
            toast.error(startTrip.error.message);
          }
        }}
      >
        {startTrip.error ? <Alert tone="error">{startTrip.error.message}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
