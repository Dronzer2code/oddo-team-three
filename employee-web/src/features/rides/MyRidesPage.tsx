import { Link } from 'react-router-dom';
import { formatRelative } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  RequestStatusBadge,
  SectionHeading,
  SkeletonCards,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useRoleMode } from '../../lib/roleMode';
import { RideCard } from '../../components/RideCard';

export function MyRidesPage() {
  const toast = useToast();
  const { isDriverMode } = useRoleMode();
  const mine = useApi(() => api.employee.rides.mine(), []);
  const incoming = useApi(() => api.employee.rides.incomingRequests(), []);

  const respond = useMutation((rideId: string, requestId: string, action: 'accept' | 'reject') =>
    api.employee.rides.respond(rideId, requestId, action),
  );

  const driving = mine.data?.driving ?? [];
  const riding = mine.data?.riding ?? [];
  const requests = incoming.data ?? [];

  return (
    <>
      <PageHeader
        title={isDriverMode ? 'My Offered Rides' : 'My Bookings'}
        lead={
          isDriverMode
            ? 'Rides you are driving and offering empty seats to colleagues.'
            : 'Rides where you requested or hold a passenger seat.'
        }
        actions={
          isDriverMode ? (
            <Link className="btn btn-accent" to="/rides/new">
              <Icon name="plus" size={16} />
              Publish a ride
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/rides">
              <Icon name="search" size={16} />
              Find a ride
            </Link>
          )
        }
      />

      {requests.length > 0 ? (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader
            title={`${requests.length} seat request${requests.length === 1 ? '' : 's'} waiting`}
            lead="Accept or decline so your passengers can plan their morning"
          />
          <CardBody flush>
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <Identity
                          name={request.passenger.name}
                          meta={request.passenger.department ?? '—'}
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
                        <div className="table__actions">
                          <Link className="btn btn-ghost btn-sm" to={`/rides/${request.rideId}`}>
                            Open ride
                          </Link>
                          <Button
                            variant="primary"
                            size="sm"
                            loading={respond.busy}
                            onClick={async () => {
                              const result = await respond.run(request.rideId, request.id, 'accept');
                              if (result) {
                                toast.success(`${request.passenger.name} is on board`);
                                incoming.reload();
                                mine.reload();
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
                              const result = await respond.run(request.rideId, request.id, 'reject');
                              if (result) {
                                toast.info('Request declined');
                                incoming.reload();
                                mine.reload();
                              } else if (respond.error) {
                                toast.error(respond.error.message);
                              }
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {mine.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(mine.error)} onRetry={mine.reload} />
        </Card>
      ) : mine.initialLoading ? (
        <SkeletonCards count={2} />
      ) : (
        <>
          <SectionHeading
            title="You are driving"
            lead={`${driving.length} ride${driving.length === 1 ? '' : 's'}`}
          />
          {driving.length === 0 ? (
            <Card>
              <EmptyState
                icon="car"
                title="You have not published a ride yet"
                text="Offer the empty seats on the commute you already make."
                action={
                  <Link className="btn btn-primary" to="/rides/new">
                    Publish a ride
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cards">
              {driving.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}

          <SectionHeading
            title="You are riding"
            lead={`${riding.length} ride${riding.length === 1 ? '' : 's'} with a request or confirmed seat`}
          />
          {riding.length === 0 ? (
            <Card>
              <EmptyState
                icon="seat"
                title="No seats requested"
                text="When you request a seat on a colleague's ride it appears here with its status."
                action={
                  <Link className="btn btn-primary" to="/rides">
                    Find a ride
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cards">
              {riding.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  action={
                    <div className="row" style={{ gap: 'var(--space-2)' }}>
                      {ride.viewer.requestStatus ? (
                        <RequestStatusBadge status={ride.viewer.requestStatus} />
                      ) : null}
                      <Link className="btn btn-secondary btn-sm" to={`/rides/${ride.id}`}>
                        View
                        <Icon name="arrowRight" size={14} />
                      </Link>
                    </div>
                  }
                />
              ))}
            </div>
          )}

          {driving.length > 0 ? (
            <Alert tone="info" className="animate-in">
              Start a trip from the ride page when you set off. Completing it with the real distance is what
              produces the cost split and the company&apos;s reporting.
            </Alert>
          ) : null}
        </>
      )}
    </>
  );
}
