import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatPlate,
  type Ride,
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
  Modal,
  PageHeader,
  Plate,
  RouteTimeline,
  Seats,
  Select,
  Skeleton,
  Textarea,
  resolveErrorCopy,
  useToast,
  vehicleImage,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { RouteMap } from '../../components/RouteMap';

/**
 * A ride, seen by a passenger. Nothing on this page can manage the ride — the
 * only action is requesting a seat, and the driver's phone number stays hidden
 * until that request is accepted.
 */
export function PassengerRideDetailPage() {
  const { id = '' } = useParams();
  const ride = useApi(() => api.employee.rides.get(id), [id]);
  const [requestOpen, setRequestOpen] = useState(false);

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
  const own = data.requests?.[0] ?? null;

  return (
    <>
      <PageHeader
        title={`${data.startLocation} → ${data.destination}`}
        lead={formatDateTime(data.departureAt)}
        breadcrumbs={[{ label: 'Find a Ride', href: '/passenger/rides' }, { label: 'Ride details' }]}
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
        actions={
          data.viewer.canRequest ? (
            <Button variant="primary" icon="seat" onClick={() => setRequestOpen(true)}>
              Request Seat
            </Button>
          ) : own && own.status === 'pending' ? (
            <Badge tone="warning">Request pending</Badge>
          ) : own && own.status === 'accepted' ? (
            <Link className="btn btn-secondary" to={`/passenger/bookings/${own.id}`}>
              View Booking
              <Icon name="arrowRight" size={14} />
            </Link>
          ) : (
            <Badge>Not available</Badge>
          )
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" lead="Pickup and destination for this ride." />
            <CardBody className="stack">
              <RouteMap from={data.startLocation} to={data.destination} height={300} />
              <RouteTimeline from={data.startLocation} to={data.destination} />
              <DetailList
                items={[
                  { label: 'Departure time', value: formatDateTime(data.departureAt) },
                  { label: 'Estimated distance', value: formatDistance(data.estimatedDistanceKm) },
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
                  { label: 'Driver notes', value: data.notes ?? '—' },
                ]}
              />
            </CardBody>
          </Card>

          {own ? (
            <Card>
              <CardHeader title="Your request" lead={`Submitted ${formatDateTime(own.createdAt)}`} />
              <CardBody>
                <DetailList
                  items={[
                    { label: 'Seats requested', value: own.seats },
                    { label: 'Status', value: own.status },
                    { label: 'Your note', value: own.note ?? '—' },
                  ]}
                />
              </CardBody>
            </Card>
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
                <p className="t-caption">
                  Contact details are shared once the driver accepts your seat request.
                </p>
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
                  { label: 'Color', value: data.vehicle.color ?? '—' },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <RequestSeatModal
        ride={requestOpen ? data : null}
        onClose={() => setRequestOpen(false)}
        onDone={() => {
          setRequestOpen(false);
          ride.reload();
        }}
      />
    </>
  );
}

/**
 * Request Seat. The button disables on submit, backend errors are shown in
 * place, and the modal only closes once the API has actually succeeded.
 */
function RequestSeatModal({
  ride,
  onClose,
  onDone,
}: {
  ride: Ride | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [seats, setSeats] = useState('1');
  const [note, setNote] = useState('');

  const mutation = useMutation((rideId: string, body: { seats: number; note?: string }) =>
    api.employee.rides.requestSeat(rideId, body),
  );

  if (!ride) return null;

  const count = Number(seats) || 1;
  const total = ride.costPerSeat * count;

  async function submit() {
    const result = await mutation.run(ride!.id, { seats: count, note: note.trim() || undefined });
    if (result) {
      toast.success('Seat requested — the driver has been notified');
      setSeats('1');
      setNote('');
      onDone();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request Seat"
      lead={`${ride.startLocation} → ${ride.destination}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={mutation.busy}>
            Confirm Request
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}

        {/* The path you are about to book, at the moment you commit to it. */}
        <RouteMap from={ride.startLocation} to={ride.destination} height={200} />

        <DetailList
          items={[
            { label: 'Ride route', value: `${ride.startLocation} → ${ride.destination}` },
            { label: 'Departure time', value: formatDateTime(ride.departureAt) },
            { label: 'Driver', value: ride.driver.name },
            { label: 'Vehicle', value: `${ride.vehicle.make} ${ride.vehicle.model}` },
            { label: 'Available seats', value: `${ride.seatsAvailable} of ${ride.totalSeats}` },
          ]}
        />

        <Select
          label="Number of seats"
          value={seats}
          onChange={(event) => setSeats(event.target.value)}
          options={Array.from({ length: Math.max(1, Math.min(ride.seatsAvailable, 10)) }).map((_, index) => ({
            value: String(index + 1),
            label: `${index + 1} seat${index === 0 ? '' : 's'}`,
          }))}
          error={mutation.error?.fieldErrors.seats}
        />

        <div className="row-between">
          <span className="t-caption">Estimated total cost</span>
          <span className="t-medium">{formatMoney(total, ride.currency)}</span>
        </div>

        <Textarea
          label="Note"
          optional
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="I can wait at the main gate"
        />
      </div>
    </Modal>
  );
}
