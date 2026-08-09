import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  RIDE_REQUEST_STATUS_LABEL,
  formatDateTime,
  formatRelative,
  type Ride,
  type RideRequest,
} from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  Modal,
  PageHeader,
  RequestStatusBadge,
  RouteInline,
  Seats,
  SkeletonCards,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

/**
 * Requests. Two entry points, one screen: the nav tab shows every pending
 * request across all of the driver's rides, and `/driver/rides/:id/requests`
 * narrows it to one ride. Accepting is the only thing that consumes a seat.
 */
export function DriverRequestsPage({ scoped = false }: { scoped?: boolean }) {
  const { id: rideId } = useParams();
  const toast = useToast();

  const mine = useApi(() => api.employee.rides.mine(), []);
  const incoming = useApi(() => api.employee.rides.incomingRequests(), []);
  const scopedRequests = useApi(
    () => (scoped && rideId ? api.employee.rides.requests(rideId) : Promise.resolve([] as RideRequest[])),
    [scoped, rideId],
  );
  const ride = useApi(
    () => (scoped && rideId ? api.employee.rides.get(rideId) : Promise.resolve(null as Ride | null)),
    [scoped, rideId],
  );

  const [acceptTarget, setAcceptTarget] = useState<RideRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RideRequest | null>(null);
  const [passengerTarget, setPassengerTarget] = useState<RideRequest | null>(null);

  const respond = useMutation((rideIdArg: string, requestId: string, action: 'accept' | 'reject') =>
    api.employee.rides.respond(rideIdArg, requestId, action),
  );

  const driving = mine.data?.driving ?? [];
  const requests = scoped ? scopedRequests.data ?? [] : incoming.data ?? [];
  const source = scoped ? scopedRequests : incoming;

  function rideFor(request: RideRequest): Ride | null {
    if (scoped) return ride.data ?? null;
    return driving.find((candidate) => candidate.id === request.rideId) ?? null;
  }

  function refreshAll() {
    mine.reload();
    incoming.reload();
    if (scoped) {
      scopedRequests.reload();
      ride.reload();
    }
  }

  async function decide(request: RideRequest, action: 'accept' | 'reject') {
    const result = await respond.run(request.rideId, request.id, action);
    if (result) {
      toast.success(action === 'accept' ? 'Request accepted' : 'Request rejected');
      setAcceptTarget(null);
      setRejectTarget(null);
      refreshAll();
    } else if (respond.error) {
      toast.error(respond.error.message);
    }
  }

  const header = scoped && ride.data ? `${ride.data.startLocation} → ${ride.data.destination}` : 'Requests';

  return (
    <>
      <PageHeader
        title={scoped ? 'Manage Requests' : 'Requests'}
        lead={
          scoped
            ? header
            : 'Passengers waiting on a seat across every ride you have published.'
        }
        breadcrumbs={
          scoped ? [{ label: 'My Rides', href: '/driver/rides' }, { label: 'Manage Requests' }] : undefined
        }
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
        actions={
          <Button variant="secondary" icon="refresh" onClick={refreshAll} loading={source.loading}>
            Refresh
          </Button>
        }
      />

      {scoped && ride.data ? (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardBody tight>
            <div className="row-between">
              <div>
                <RouteInline from={ride.data.startLocation} to={ride.data.destination} />
                <div className="t-caption">{formatDateTime(ride.data.departureAt)}</div>
              </div>
              <span className="row" style={{ gap: 'var(--space-2)' }}>
                <Seats total={ride.data.totalSeats} taken={ride.data.seatsTaken} />
                <span className="t-caption">
                  {ride.data.seatsAvailable} of {ride.data.totalSeats} seats free
                </span>
              </span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {source.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(source.error)} onRetry={source.reload} />
        </Card>
      ) : source.initialLoading ? (
        <SkeletonCards count={3} />
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon="seat"
            title="No seat requests"
            text={
              scoped
                ? 'Nobody has asked for a seat on this ride yet.'
                : 'When a colleague requests a seat on one of your rides, it lands here.'
            }
            action={
              <Link className="btn btn-secondary" to="/driver/rides">
                My Rides
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cards">
          {requests.map((request) => {
            const requestRide = rideFor(request);
            const pending = request.status === 'pending';
            return (
              <Card key={request.id}>
                <CardHeader
                  title={<Identity name={request.passenger.name} meta={request.passenger.department ?? 'Colleague'} />}
                  actions={<RequestStatusBadge status={request.status} />}
                />
                <CardBody className="stack">
                  {requestRide ? (
                    <>
                      <RouteInline from={requestRide.startLocation} to={requestRide.destination} />
                      <div className="t-caption">{formatDateTime(requestRide.departureAt)}</div>
                    </>
                  ) : null}

                  <dl className="detail-list">
                    <div className="detail-list__item">
                      <dt className="detail-list__label">Passenger</dt>
                      <dd className="detail-list__value">{request.passenger.name}</dd>
                    </div>
                    <div className="detail-list__item">
                      <dt className="detail-list__label">Seats requested</dt>
                      <dd className="detail-list__value">{request.seats}</dd>
                    </div>
                    <div className="detail-list__item">
                      <dt className="detail-list__label">Status</dt>
                      <dd className="detail-list__value">{RIDE_REQUEST_STATUS_LABEL[request.status]}</dd>
                    </div>
                    <div className="detail-list__item">
                      <dt className="detail-list__label">Requested</dt>
                      <dd className="detail-list__value">{formatRelative(request.createdAt)}</dd>
                    </div>
                  </dl>

                  {request.note ? <Alert tone="info">“{request.note}”</Alert> : null}

                  <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      icon="check"
                      disabled={!pending}
                      onClick={() => setAcceptTarget(request)}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="danger-outline"
                      size="sm"
                      icon="x"
                      disabled={!pending}
                      onClick={() => setRejectTarget(request)}
                    >
                      Reject
                    </Button>
                    <Button variant="ghost" size="sm" icon="user" onClick={() => setPassengerTarget(request)}>
                      View Passenger
                    </Button>
                    {!scoped && requestRide ? (
                      <Link className="btn btn-ghost btn-sm" to={`/driver/rides/${requestRide.id}/requests`}>
                        Open ride
                        <Icon name="arrowRight" size={13} />
                      </Link>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={acceptTarget !== null}
        title="Accept Request"
        message={
          acceptTarget
            ? `${acceptTarget.passenger.name} takes ${acceptTarget.seats} seat${
                acceptTarget.seats === 1 ? '' : 's'
              }. The seat count updates for everyone straight away.`
            : ''
        }
        confirmLabel="Accept"
        cancelLabel="Not now"
        busy={respond.busy}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => acceptTarget && decide(acceptTarget, 'accept')}
      >
        {respond.error ? <Alert tone="error">{respond.error.message}</Alert> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectTarget !== null}
        title="Reject Request"
        message={
          rejectTarget
            ? `${rejectTarget.passenger.name} will be told the seat is not available and can look for another ride.`
            : ''
        }
        confirmLabel="Reject"
        cancelLabel="Not now"
        tone="danger"
        busy={respond.busy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && decide(rejectTarget, 'reject')}
      >
        {respond.error ? <Alert tone="error">{respond.error.message}</Alert> : null}
      </ConfirmDialog>

      <Modal
        open={passengerTarget !== null}
        onClose={() => setPassengerTarget(null)}
        title="Passenger"
        lead={passengerTarget?.passenger.name}
        footer={
          <Button variant="secondary" onClick={() => setPassengerTarget(null)}>
            Close
          </Button>
        }
      >
        {passengerTarget ? (
          <div className="stack">
            <Identity
              name={passengerTarget.passenger.name}
              meta={passengerTarget.passenger.department ?? 'Colleague'}
            />
            <dl className="detail-list">
              <div className="detail-list__item">
                <dt className="detail-list__label">Department</dt>
                <dd className="detail-list__value">{passengerTarget.passenger.department ?? '—'}</dd>
              </div>
              <div className="detail-list__item">
                <dt className="detail-list__label">Phone</dt>
                <dd className="detail-list__value">
                  {passengerTarget.passenger.phone ?? 'Shared once you accept the request'}
                </dd>
              </div>
              <div className="detail-list__item">
                <dt className="detail-list__label">Seats requested</dt>
                <dd className="detail-list__value">{passengerTarget.seats}</dd>
              </div>
              <div className="detail-list__item">
                <dt className="detail-list__label">Note</dt>
                <dd className="detail-list__value">{passengerTarget.note ?? '—'}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
