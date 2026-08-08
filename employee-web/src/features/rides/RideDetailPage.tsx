import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RIDE_STATUS,
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatRelative,
  formatTime,
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
  Input,
  Modal,
  PageHeader,
  Plate,
  RequestStatusBadge,
  RideStatusBadge,
  RouteTimeline,
  Seats,
  Skeleton,
  Textarea,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useAuth, isOperational } from '../../lib/auth';

export function RideDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const ride = useApi(() => api.employee.rides.get(id), [id]);

  const [requestOpen, setRequestOpen] = useState(false);
  const [seats, setSeats] = useState('1');
  const [note, setNote] = useState('');
  const [cancelRide, setCancelRide] = useState(false);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  const requestSeat = useMutation((body: { seats: number; note?: string }) =>
    api.employee.rides.requestSeat(id, body),
  );
  const respond = useMutation((requestId: string, action: 'accept' | 'reject') =>
    api.employee.rides.respond(id, requestId, action),
  );
  const withdraw = useMutation((requestId: string) => api.employee.rides.withdraw(id, requestId));
  const cancel = useMutation(() => api.employee.rides.cancel(id));
  const startTrip = useMutation(() => api.employee.trips.start(id));

  if (ride.error) {
    return (
      <>
        <PageHeader title="Ride" />
        <Card>
          <ErrorState {...resolveErrorCopy(ride.error)} onRetry={ride.reload} />
        </Card>
      </>
    );
  }

  if (ride.initialLoading || !ride.data) {
    return (
      <>
        <PageHeader title="Ride" />
        <div className="grid grid-even">
          <Skeleton variant="block" height={240} />
          <Skeleton variant="block" height={240} />
        </div>
      </>
    );
  }

  const data = ride.data;
  const pendingRequests = (data.requests ?? []).filter((request) => request.status === 'pending');
  const acceptedRequests = (data.requests ?? []).filter((request) => request.status === 'accepted');
  const myRequest = (data.requests ?? []).find((request) => request.passenger.id === user?.id);
  const canStart =
    data.viewer.isDriver && (data.status === RIDE_STATUS.PUBLISHED || data.status === RIDE_STATUS.FULL);

  return (
    <>
      <PageHeader
        title={`${formatTime(data.departureAt)} · ${data.startLocation} → ${data.destination}`}
        lead={formatDateTime(data.departureAt)}
        breadcrumbs={[
          {
            label: data.viewer.isDriver ? 'My rides' : 'Find a ride',
            href: data.viewer.isDriver ? '/my-rides' : '/rides',
          },
          { label: 'Ride' },
        ]}
        renderLink={(crumb) => <Link to={crumb.href!}>{crumb.label}</Link>}
        actions={
          <>
            <RideStatusBadge status={data.status} />
            {canStart ? (
              <Button
                variant="accent"
                icon="play"
                loading={startTrip.busy}
                onClick={async () => {
                  const trip = await startTrip.run();
                  if (trip) {
                    toast.success('Trip started');
                    navigate(`/trips/${trip.id}`);
                  } else if (startTrip.error) {
                    toast.error(startTrip.error.message);
                  }
                }}
              >
                Start trip
              </Button>
            ) : null}
            {data.tripId ? (
              <Link className="btn btn-primary" to={`/trips/${data.tripId}`}>
                Open trip
                <Icon name="arrowRight" size={15} />
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-even" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" />
            <CardBody className="stack-lg">
              <RouteTimeline
                from={data.startLocation}
                to={data.destination}
                middle={
                  <span className="t-caption">
                    {formatDistance(data.estimatedDistanceKm)} · departs {formatTime(data.departureAt)}
                  </span>
                }
              />
              <div className="road-rule" />
              <DetailList
                items={[
                  { label: 'Departure', value: formatDateTime(data.departureAt) },
                  { label: 'Distance', value: formatDistance(data.estimatedDistanceKm) },
                  {
                    label: 'Seats',
                    value: (
                      <span className="row" style={{ gap: 'var(--space-2)' }}>
                        <Seats total={data.totalSeats} taken={data.seatsTaken} />
                        <span className="t-caption">
                          {data.seatsAvailable} of {data.totalSeats} free
                        </span>
                      </span>
                    ),
                  },
                  { label: 'Cost per seat', value: formatMoney(data.costPerSeat, data.currency) },
                  { label: 'Total ride cost', value: formatMoney(data.estimatedCost, data.currency) },
                  { label: 'Published', value: formatRelative(data.createdAt) },
                ]}
              />
              {data.notes ? <Alert tone="info">{data.notes}</Alert> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Driver and vehicle" />
            <CardBody className="stack">
              <Identity
                name={data.viewer.isDriver ? `${data.driver.name} (you)` : data.driver.name}
                meta={data.driver.department ?? 'Driver'}
                size="lg"
              />
              {data.driver.phone ? (
                <div className="row t-caption">
                  <Icon name="phone" size={14} />
                  {data.driver.phone}
                </div>
              ) : (
                <p className="t-caption">
                  The driver&apos;s phone number is shared once your seat request is accepted.
                </p>
              )}
              <div className="road-rule" />
              <div className="row-between">
                <span className="row">
                  <span className="card-statistic__icon">
                    <Icon name="car" size={16} />
                  </span>
                  <span>
                    <span className="t-medium">
                      {data.vehicle.make} {data.vehicle.model}
                    </span>
                    <div className="t-caption">
                      {VEHICLE_TYPE_LABEL[data.vehicle.vehicleType]} · {data.vehicle.seatingCapacity} seats
                      {data.vehicle.color ? ` · ${data.vehicle.color}` : ''}
                    </div>
                  </span>
                </span>
                <Plate>{data.vehicle.registrationNumber}</Plate>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          {!data.viewer.isDriver ? (
            <Card>
              <CardHeader title="Your seat" />
              <CardBody className="stack">
                {myRequest ? (
                  <>
                    <div className="row-between">
                      <span className="t-medium">
                        {myRequest.seats} seat{myRequest.seats === 1 ? '' : 's'} requested
                      </span>
                      <RequestStatusBadge status={myRequest.status} />
                    </div>
                    {myRequest.note ? <p className="t-caption">“{myRequest.note}”</p> : null}
                    {myRequest.status === 'accepted' ? (
                      <Alert tone="success">
                        Your seat is confirmed. The driver&apos;s phone number is shown on the left.
                      </Alert>
                    ) : null}
                    {myRequest.status === 'pending' ? (
                      <Alert tone="warning">Waiting for {data.driver.name} to accept your request.</Alert>
                    ) : null}
                    {myRequest.status === 'rejected' ? (
                      <Alert tone="warning">
                        This request was declined. You can look for another ride, or request again if seats
                        free up.
                      </Alert>
                    ) : null}
                    {['pending', 'accepted'].includes(myRequest.status) ? (
                      <Button variant="danger-outline" onClick={() => setWithdrawId(myRequest.id)}>
                        Withdraw request
                      </Button>
                    ) : null}
                  </>
                ) : data.viewer.canRequest && isOperational(user) ? (
                  <>
                    <p className="t-caption">
                      {data.seatsAvailable} seat{data.seatsAvailable === 1 ? '' : 's'} available at{' '}
                      {formatMoney(data.costPerSeat, data.currency)} each.
                    </p>
                    <Button variant="primary" icon="seat" onClick={() => setRequestOpen(true)}>
                      Request a seat
                    </Button>
                  </>
                ) : (
                  <Alert tone="info">
                    {!isOperational(user)
                      ? 'Your account cannot request rides right now.'
                      : data.status !== RIDE_STATUS.PUBLISHED
                        ? 'This ride is no longer accepting requests.'
                        : 'No seats left on this ride.'}
                  </Alert>
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Seat requests"
                lead={`${pendingRequests.length} pending · ${acceptedRequests.length} confirmed`}
              />
              <CardBody flush>
                {(data.requests ?? []).length === 0 ? (
                  <EmptyState
                    icon="seat"
                    title="No requests yet"
                    text="Colleagues searching your route will see this ride and can request a seat."
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <tbody>
                        {(data.requests ?? []).map((request) => (
                          <tr key={request.id}>
                            <td>
                              <Identity
                                name={request.passenger.name}
                                meta={`${request.passenger.department ?? '—'}${
                                  request.passenger.phone ? ` · ${request.passenger.phone}` : ''
                                }`}
                                size="sm"
                              />
                              {request.note ? (
                                <div className="t-caption" style={{ marginTop: 4 }}>
                                  “{request.note}”
                                </div>
                              ) : null}
                            </td>
                            <td className="t-caption t-nowrap">
                              {request.seats} seat{request.seats === 1 ? '' : 's'}
                              <div className="t-muted" style={{ fontSize: 11 }}>
                                {formatRelative(request.createdAt)}
                              </div>
                            </td>
                            <td>
                              {request.status === 'pending' ? (
                                <div className="table__actions">
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    loading={respond.busy}
                                    onClick={async () => {
                                      const result = await respond.run(request.id, 'accept');
                                      if (result) {
                                        toast.success(`${request.passenger.name} is on board`);
                                        ride.reload();
                                      } else if (respond.error) {
                                        toast.error(respond.error.message);
                                      }
                                    }}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      const result = await respond.run(request.id, 'reject');
                                      if (result) {
                                        toast.info('Request declined');
                                        ride.reload();
                                      } else if (respond.error) {
                                        toast.error(respond.error.message);
                                      }
                                    }}
                                  >
                                    Decline
                                  </Button>
                                </div>
                              ) : (
                                <div className="table__actions">
                                  <RequestStatusBadge status={request.status} />
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {data.viewer.isDriver ? (
            <Card>
              <CardHeader title="Manage this ride" />
              <CardBody className="stack">
                {data.status === RIDE_STATUS.PUBLISHED || data.status === RIDE_STATUS.FULL ? (
                  <>
                    <p className="t-caption">
                      Starting the trip freezes the vehicle and the current cost configuration onto the trip
                      record, so later price changes never rewrite this journey.
                    </p>
                    <Button variant="danger-outline" icon="x" onClick={() => setCancelRide(true)}>
                      Cancel this ride
                    </Button>
                  </>
                ) : (
                  <Alert tone="info">
                    This ride is {data.status.replace('_', ' ')} and can no longer be changed.{' '}
                    {data.tripId ? 'Open the trip to see the final distance and cost.' : ''}
                  </Alert>
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody tight>
                <div className="row" style={{ gap: 'var(--space-3)' }}>
                  <Badge tone="neutral" plain>
                    <Icon name="shield" size={12} />
                  </Badge>
                  <p className="t-caption">
                    Only colleagues in {user?.organizationName} can see this ride. Contact details are shared
                    after a seat is confirmed.
                  </p>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request a seat"
        lead={`${data.startLocation} → ${data.destination} at ${formatTime(data.departureAt)}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestOpen(false)} disabled={requestSeat.busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={requestSeat.busy}
              onClick={async () => {
                const result = await requestSeat.run({
                  seats: Number(seats),
                  note: note.trim() || undefined,
                });
                if (result) {
                  toast.success('Seat requested — the driver will confirm shortly');
                  setRequestOpen(false);
                  setNote('');
                  ride.reload();
                }
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="stack">
          {requestSeat.error ? <Alert tone="error">{requestSeat.error.message}</Alert> : null}
          <Input
            label="Seats needed"
            type="number"
            min={1}
            max={data.seatsAvailable}
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
            error={requestSeat.error?.fieldErrors.seats}
            hint={`${data.seatsAvailable} available`}
          />
          <Textarea
            label="Note for the driver"
            optional
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Can you stop at the crossing?"
          />
          <Alert tone="info">
            Your share is about {formatMoney(data.costPerSeat, data.currency)} per seat. The final amount is
            calculated when the trip completes.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelRide}
        title="Cancel this ride?"
        message="Everyone with a pending or confirmed seat is released. This cannot be undone."
        confirmLabel="Cancel ride"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancel.busy}
        onCancel={() => setCancelRide(false)}
        onConfirm={async () => {
          const result = await cancel.run();
          if (result) {
            toast.success('Ride canceled');
            setCancelRide(false);
            ride.reload();
          } else if (cancel.error) {
            toast.error(cancel.error.message);
          }
        }}
      />

      <ConfirmDialog
        open={withdrawId !== null}
        title="Withdraw your request?"
        message="Your seat is released so somebody else can take it."
        confirmLabel="Withdraw"
        cancelLabel="Keep my seat"
        tone="danger"
        busy={withdraw.busy}
        onCancel={() => setWithdrawId(null)}
        onConfirm={async () => {
          if (!withdrawId) return;
          const result = await withdraw.run(withdrawId);
          if (result) {
            toast.info('Request withdrawn');
            setWithdrawId(null);
            ride.reload();
          } else if (withdraw.error) {
            toast.error(withdraw.error.message);
          }
        }}
      />
    </>
  );
}
