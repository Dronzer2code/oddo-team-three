import { Link } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDistance,
  formatMoney,
  formatPlate,
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
  DetailList,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  Plate,
  RouteTimeline,
  Skeleton,
  TripStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { RouteMap } from '../../components/RouteMap';

/**
 * Live Trip. There is no GPS feed in this deployment, so the page shows the
 * real trip state and says plainly that live location is unavailable — it
 * never animates a marker the server did not send.
 */
export function LiveTripPage() {
  const trip = useApi(() => api.employee.trips.active(), []);

  if (trip.error) {
    return (
      <Card>
        <ErrorState {...resolveErrorCopy(trip.error)} onRetry={trip.reload} />
      </Card>
    );
  }

  if (trip.initialLoading) {
    return (
      <div className="stack">
        <Skeleton variant="title" width="40%" />
        <Skeleton variant="block" height={240} />
      </div>
    );
  }

  const data = trip.data;

  if (!data || data.viewerRole === 'driver') {
    return (
      <>
        <PageHeader title="Live Trip" lead="Track the ride you are currently on." />
        <Card>
          <EmptyState
            icon="pin"
            title="No trip is under way"
            text={
              data?.viewerRole === 'driver'
                ? 'You are driving this trip — open the Driver panel to manage it.'
                : 'When your driver starts the trip, it appears here with its live status.'
            }
            action={
              <Link className="btn btn-primary" to="/passenger/bookings">
                My Bookings
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const share = data.viewerShare;

  return (
    <>
      <PageHeader
        title="Live Trip"
        lead={`Started ${formatRelative(data.startedAt)} · ${formatTime(data.startedAt)}`}
        actions={
          <>
            <TripStatusBadge status={data.status} />
            <Button variant="secondary" icon="refresh" onClick={trip.reload} loading={trip.loading}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" lead="Pickup and destination for this trip." />
            <CardBody className="stack">
              <RouteMap from={data.startLocation} to={data.destination} height={320} />
              <RouteTimeline from={data.startLocation} to={data.destination} />
              {/* The route is real; the driver's position on it is not tracked,
                  and saying so beats animating a marker nothing reports. */}
              <Alert tone="info">
                The route above is the one your driver published. Live vehicle position is not tracked in
                this deployment — the trip status below is set by the driver and is accurate as of{' '}
                {formatTime(data.startedAt)}.
              </Alert>
              <DetailList
                items={[
                  { label: 'Trip status', value: data.status === 'in_progress' ? 'Started' : data.status },
                  { label: 'Started at', value: formatTime(data.startedAt) },
                  { label: 'Planned distance', value: formatDistance(data.distanceKm) },
                  {
                    label: 'Your estimated share',
                    value: share !== null ? formatMoney(share, data.currency) : 'Calculated at completion',
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="On board" lead={`${data.participants.length} people on this trip`} />
            <CardBody flush>
              <div className="table-responsive">
                <table className="table">
                  <tbody>
                    {data.participants.map((participant) => (
                      <tr key={participant.id}>
                        <td>
                          <Identity
                            name={participant.name}
                            meta={participant.role === 'driver' ? 'Driver' : 'Passenger'}
                            size="sm"
                          />
                        </td>
                        <td className="t-right t-caption">
                          {participant.seats} seat{participant.seats === 1 ? '' : 's'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Driver" />
            <CardBody className="stack">
              <Identity name={data.driverName} meta="Driving this trip" />
              {data.participants.find((participant) => participant.role === 'driver')?.phone ? (
                <div className="t-caption">
                  <Icon name="phone" size={13} />{' '}
                  {data.participants.find((participant) => participant.role === 'driver')?.phone}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle" />
            <CardBody className="stack">
              <div className="t-medium">
                {data.vehicleSnapshot.make} {data.vehicleSnapshot.model}
              </div>
              <Plate>{formatPlate(data.vehicleSnapshot.registrationNumber)}</Plate>
              <DetailList
                items={[
                  { label: 'Type', value: VEHICLE_TYPE_LABEL[data.vehicleSnapshot.vehicleType] },
                  { label: 'Seats', value: data.vehicleSnapshot.seatingCapacity },
                ]}
              />
              <Badge tone="ink">Vehicle recorded at trip start</Badge>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Link className="btn btn-secondary btn-sm" to="/passenger/help">
                <Icon name="shield" size={14} />
                Help &amp; Safety
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
