import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TRIP_STATUS, formatDateTime, formatDistance, formatMoney, formatNumber } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  ErrorState,
  Icon,
  Identity,
  Input,
  Modal,
  PageHeader,
  Plate,
  RouteTimeline,
  Skeleton,
  TripStatusBadge,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';

export function TripDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const trip = useApi(() => api.employee.trips.get(id), [id]);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [distance, setDistance] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  const complete = useMutation((km?: number) => api.employee.trips.complete(id, km));
  const cancel = useMutation(() => api.employee.trips.cancel(id));

  if (trip.error) {
    return (
      <>
        <PageHeader title="Trip" />
        <Card>
          <ErrorState {...resolveErrorCopy(trip.error)} onRetry={trip.reload} />
        </Card>
      </>
    );
  }

  if (trip.initialLoading || !trip.data) {
    return (
      <>
        <PageHeader title="Trip" />
        <div className="grid grid-even">
          <Skeleton variant="block" height={240} />
          <Skeleton variant="block" height={240} />
        </div>
      </>
    );
  }

  const data = trip.data;
  const isDriver = data.driverId === user?.id;
  const active = data.status === TRIP_STATUS.IN_PROGRESS;
  const driver = data.participants.find((participant) => participant.role === 'driver');
  const passengers = data.participants.filter((participant) => participant.role === 'passenger');

  return (
    <>
      <PageHeader
        title={`${data.startLocation} → ${data.destination}`}
        lead={`Started ${formatDateTime(data.startedAt)}`}
        breadcrumbs={[{ label: 'Trips', href: '/trips' }, { label: 'Trip' }]}
        renderLink={(crumb) => <Link to={crumb.href!}>{crumb.label}</Link>}
        actions={
          <>
            <TripStatusBadge status={data.status} />
            {isDriver && active ? (
              <>
                <Button
                  variant="accent"
                  icon="flag"
                  onClick={() => {
                    setDistance(String(data.distanceKm || ''));
                    setCompleteOpen(true);
                  }}
                >
                  Complete trip
                </Button>
                <Button variant="danger-outline" icon="x" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid grid-even" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Journey" />
            <CardBody className="stack-lg">
              <RouteTimeline
                from={data.startLocation}
                to={data.destination}
                middle={
                  <div className="stack-sm">
                    <span className="t-caption">
                      {formatDistance(data.distanceKm)} · {data.participants.length} on board
                    </span>
                    {active ? (
                      <Badge tone="ink">
                        <Icon name="clock" size={11} />
                        In progress
                      </Badge>
                    ) : null}
                  </div>
                }
              />
              <div className="road-rule" />
              <DetailList
                items={[
                  { label: 'Started', value: formatDateTime(data.startedAt) },
                  { label: 'Completed', value: data.completedAt ? formatDateTime(data.completedAt) : '—' },
                  { label: 'Distance', value: formatDistance(data.distanceKm) },
                  { label: 'Fuel consumed', value: `${formatNumber(data.fuelConsumedLitres, 2)} L` },
                  { label: 'Total cost', value: formatMoney(data.totalCost, data.currency) },
                  { label: 'Cost per km', value: formatMoney(data.costPerKm, data.currency, 2) },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle at the time of the trip" lead="Snapshot — never recomputed" />
            <CardBody>
              <div className="row-between">
                <span className="row">
                  <span className="card-statistic__icon">
                    <Icon name="car" size={16} />
                  </span>
                  <span>
                    <span className="t-medium">
                      {data.vehicleSnapshot.make} {data.vehicleSnapshot.model}
                    </span>
                    <div className="t-caption">
                      {data.vehicleSnapshot.seatingCapacity} seats
                      {data.vehicleSnapshot.color ? ` · ${data.vehicleSnapshot.color}` : ''}
                    </div>
                  </span>
                </span>
                <Plate>{data.vehicleSnapshot.registrationNumber}</Plate>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="stack-lg">
          <Card>
            <CardHeader title="Who travelled" lead={`${data.participants.length} people`} />
            <CardBody flush>
              <div className="table-responsive">
                <table className="table">
                  <tbody>
                    {driver ? (
                      <tr>
                        <td>
                          <Identity
                            name={driver.id === user?.id ? `${driver.name} (you)` : driver.name}
                            meta={driver.phone ? `Driver · ${driver.phone}` : 'Driver'}
                            size="sm"
                            ink
                          />
                        </td>
                        <td className="t-right t-nowrap">
                          <div className="t-medium">{formatMoney(driver.shareAmount, data.currency)}</div>
                          <div className="t-caption">own share</div>
                        </td>
                      </tr>
                    ) : null}
                    {passengers.map((passenger) => (
                      <tr key={passenger.id}>
                        <td>
                          <Identity
                            name={passenger.id === user?.id ? `${passenger.name} (you)` : passenger.name}
                            meta={
                              passenger.phone
                                ? `${passenger.seats} seat${passenger.seats === 1 ? '' : 's'} · ${passenger.phone}`
                                : `${passenger.seats} seat${passenger.seats === 1 ? '' : 's'}`
                            }
                            size="sm"
                          />
                        </td>
                        <td className="t-right t-nowrap">
                          <div className="t-medium">{formatMoney(passenger.shareAmount, data.currency)}</div>
                          <div className="t-caption">pays the driver</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cost basis applied" lead="Frozen when the trip started" />
            <CardBody className="stack">
              <DetailList
                items={[
                  {
                    label: 'Fuel price',
                    value: `${formatMoney(data.costSnapshot.fuelCostPerLitre, data.costSnapshot.currency, 2)} / litre`,
                  },
                  {
                    label: 'Running cost',
                    value: `${formatMoney(data.costSnapshot.travelCostPerKm, data.costSnapshot.currency, 2)} / km`,
                  },
                  {
                    label: 'Fuel efficiency',
                    value: `${formatNumber(data.costSnapshot.mileageKmpl, 1)} km/l`,
                  },
                ]}
              />
              <Alert tone="info">
                If your organization changes fuel prices tomorrow, this trip keeps these exact figures.
              </Alert>
            </CardBody>
          </Card>

          {active && !isDriver ? (
            <Alert tone="info">
              The driver will complete this trip when you arrive. Your share is calculated from the actual
              distance travelled.
            </Alert>
          ) : null}
          {data.status === TRIP_STATUS.COMPLETED &&
          data.viewerShare !== null &&
          data.viewerRole === 'passenger' ? (
            <Card>
              <CardBody tight>
                <div className="row-between">
                  <span className="t-caption">
                    Your share of this trip
                    <div className="t-medium">{formatMoney(data.viewerShare, data.currency)}</div>
                  </span>
                  <Link className="btn btn-secondary btn-sm" to="/wallet">
                    Open wallet
                    <Icon name="arrowRight" size={14} />
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete this trip"
        lead="Enter the distance you actually travelled — the cost split is calculated from it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={complete.busy}>
              Cancel
            </Button>
            <Button
              variant="accent"
              loading={complete.busy}
              onClick={async () => {
                const result = await complete.run(distance ? Number(distance) : undefined);
                if (result) {
                  toast.success('Trip completed — the cost split is settled');
                  setCompleteOpen(false);
                  trip.reload();
                }
              }}
            >
              Complete trip
            </Button>
          </>
        }
      >
        <div className="stack">
          {complete.error ? <Alert tone="error">{complete.error.message}</Alert> : null}
          <Input
            label="Distance travelled (km)"
            type="number"
            step="0.1"
            min={0.1}
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
            error={complete.error?.fieldErrors.distanceKm}
            hint={`Planned ${formatDistance(data.distanceKm)}`}
            autoFocus
          />
          <Alert tone="info">
            Fuel and cost use the basis frozen when the trip started:{' '}
            {formatMoney(data.costSnapshot.fuelCostPerLitre, data.costSnapshot.currency, 2)}/litre at{' '}
            {formatNumber(data.costSnapshot.mileageKmpl, 1)} km/l.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this trip?"
        message="The ride is closed and no cost is charged to anybody. Canceled trips are never counted as completed."
        confirmLabel="Cancel trip"
        cancelLabel="Keep going"
        tone="danger"
        busy={cancel.busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          const result = await cancel.run();
          if (result) {
            toast.info('Trip canceled');
            setCancelOpen(false);
            trip.reload();
          } else if (cancel.error) {
            toast.error(cancel.error.message);
          }
        }}
      />
    </>
  );
}
