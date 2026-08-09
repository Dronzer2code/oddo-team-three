import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AUDIT_ACTION_LABEL,
  RIDE_STATUS,
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatPlate,
  formatRelative,
} from '@carpool/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
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
import { useApi } from '../../lib/hooks';
import { CancelRideDialog } from './RidesPage';

/** One ride, its passengers, its route and its audit trail. */
export function RideDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const ride = useApi(() => api.admin.rides.get(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);

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
        <Skeleton variant="title" width="42%" />
        <Skeleton variant="block" height={220} />
      </div>
    );
  }

  const data = ride.data;
  const cancellable = data.status === RIDE_STATUS.PUBLISHED || data.status === RIDE_STATUS.FULL;

  return (
    <>
      <PageHeader
        title={`${data.startLocation} → ${data.destination}`}
        lead={`${formatDateTime(data.departureAt)} · ${data.organizationName}`}
        breadcrumbs={[{ label: 'Rides', href: '/admin/rides' }, { label: 'Ride details' }]}
        renderLink={(crumb) => <Link to={crumb.href ?? '#'}>{crumb.label}</Link>}
        actions={
          <>
            <RideStatusBadge status={data.status} />
            {cancellable ? (
              <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
                Cancel Ride
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" lead={`Created ${formatRelative(data.createdAt)}`} />
            <CardBody className="stack">
              <RouteTimeline from={data.startLocation} to={data.destination} />
              <DetailList
                items={[
                  { label: 'Departure', value: formatDateTime(data.departureAt) },
                  { label: 'Estimated distance', value: formatDistance(data.estimatedDistanceKm) },
                  { label: 'Estimated cost', value: formatMoney(data.estimatedCost, data.currency) },
                  { label: 'Cost per seat', value: formatMoney(data.costPerSeat, data.currency) },
                  {
                    label: 'Seats',
                    value: (
                      <span className="row" style={{ gap: 'var(--space-2)' }}>
                        <Seats total={data.totalSeats} taken={data.seatsTaken} />
                        {data.seatsAvailable} of {data.totalSeats} free
                      </span>
                    ),
                  },
                  { label: 'Notes', value: data.notes ?? '—' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Passengers"
              lead={`${data.passengerCount} confirmed · ${data.pendingRequests} pending`}
            />
            <CardBody flush>
              {data.requests.length === 0 ? (
                <EmptyState
                  icon="seat"
                  title="No seat requests yet"
                  text="Requests appear here as colleagues ask to join this ride."
                />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Passenger</th>
                        <th>Employee ID</th>
                        <th className="is-numeric">Seats</th>
                        <th>Status</th>
                        <th>Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.requests.map((request) => (
                        <tr key={request.id}>
                          <td>
                            <Identity
                              name={request.passengerName}
                              meta={request.passengerDepartment ?? 'No department'}
                              size="sm"
                            />
                          </td>
                          <td className="t-caption">{request.passengerEmployeeCode ?? '—'}</td>
                          <td className="is-numeric">{request.seats}</td>
                          <td>
                            <RequestStatusBadge status={request.status} />
                          </td>
                          <td className="t-caption t-nowrap">{formatDateTime(request.createdAt)}</td>
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
            <CardHeader title="Driver" />
            <CardBody className="stack">
              <Identity name={data.driver.name} meta={data.driver.department ?? 'No department'} />
              <Link className="btn btn-secondary btn-sm" to={`/admin/employees/${data.driver.id}`}>
                View employee
                <Icon name="arrowRight" size={14} />
              </Link>
            </CardBody>
          </Card>

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
              <Link className="btn btn-secondary btn-sm" to={`/admin/vehicles/${data.vehicle.id}`}>
                View vehicle
                <Icon name="arrowRight" size={14} />
              </Link>
            </CardBody>
          </Card>

          {data.tripId ? (
            <Card>
              <CardHeader title="Trip" lead="This ride has an associated trip record." />
              <CardBody>
                <Link className="btn btn-secondary btn-sm" to="/admin/completed-trips">
                  View trips
                  <Icon name="arrowRight" size={14} />
                </Link>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Audit trail" />
            <CardBody flush>
              {data.auditLogs.length === 0 ? (
                <EmptyState icon="history" title="No recorded changes" />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {data.auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <div className="t-medium">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</div>
                            <div className="t-caption">{log.actorName}</div>
                          </td>
                          <td className="t-caption t-right t-nowrap">{formatRelative(log.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <CancelRideDialog
        ride={cancelOpen ? data : null}
        onClose={() => setCancelOpen(false)}
        onDone={() => {
          setCancelOpen(false);
          toast.success('Ride canceled');
          ride.reload();
        }}
      />
    </>
  );
}
