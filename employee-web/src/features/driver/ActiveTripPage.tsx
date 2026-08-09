import { useState } from 'react';
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
  RouteTimeline,
  Skeleton,
  TripStatusBadge,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { RouteMap } from '../../components/RouteMap';

/**
 * Active Trip. Completing writes the final distance, fuel, cost and cost per
 * kilometre against the cost basis frozen when the trip started — later
 * configuration changes can never rewrite this record.
 */
export function ActiveTripPage() {
  const toast = useToast();
  const trip = useApi(() => api.employee.trips.active(), []);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [distance, setDistance] = useState('');

  const complete = useMutation((id: string, km?: number) => api.employee.trips.complete(id, km));
  const cancel = useMutation((id: string) => api.employee.trips.cancel(id));

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

  if (!data || data.viewerRole !== 'driver') {
    return (
      <>
        <PageHeader title="Active Trip" lead="The trip you are currently driving." />
        <Card>
          <EmptyState
            icon="play"
            title="No trip under way"
            text={
              data
                ? 'You are a passenger on the trip currently running — open the Passenger panel to track it.'
                : 'Start one of your published rides and it appears here with its live controls.'
            }
            action={
              <Link className="btn btn-primary" to="/driver/rides">
                My Rides
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const passengers = data.participants.filter((participant) => participant.role === 'passenger');

  return (
    <>
      <PageHeader
        title="Active Trip"
        lead={`Started ${formatRelative(data.startedAt)} · ${formatTime(data.startedAt)}`}
        actions={
          <>
            <TripStatusBadge status={data.status} />
            <Button variant="primary" icon="flag" onClick={() => setCompleteOpen(true)}>
              Complete Trip
            </Button>
            <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
              Cancel Trip
            </Button>
          </>
        }
      />

      <div className="grid grid-split-tight" style={{ alignItems: 'start' }}>
        <div className="stack-lg">
          <Card>
            <CardHeader title="Route" />
            <CardBody className="stack">
              <RouteMap from={data.startLocation} to={data.destination} height={300} />
              <RouteTimeline from={data.startLocation} to={data.destination} />
              <DetailList
                items={[
                  { label: 'Started at', value: formatTime(data.startedAt) },
                  { label: 'Planned distance', value: formatDistance(data.distanceKm) },
                  {
                    label: 'Cost basis',
                    value: `${formatMoney(data.costSnapshot.travelCostPerKm, data.currency, 2)} per km · ${formatMoney(
                      data.costSnapshot.fuelCostPerLitre,
                      data.currency,
                      2,
                    )} per litre`,
                  },
                  { label: 'Mileage used', value: `${data.costSnapshot.mileageKmpl} km/l` },
                ]}
              />
              <Alert tone="info">
                The cost basis above was frozen when you started this trip. Completing applies it to the
                distance you actually travelled.
              </Alert>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Passengers on board" lead={`${passengers.length} riding with you`} />
            <CardBody flush>
              {passengers.length === 0 ? (
                <EmptyState icon="seat" title="Driving alone" text="No passengers were accepted on this ride." />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {passengers.map((passenger) => (
                        <tr key={passenger.id}>
                          <td>
                            <Identity name={passenger.name} meta={passenger.phone ?? 'Passenger'} size="sm" />
                          </td>
                          <td className="t-right t-caption">
                            {passenger.seats} seat{passenger.seats === 1 ? '' : 's'}
                          </td>
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
                {data.vehicleSnapshot.make} {data.vehicleSnapshot.model}
              </div>
              <Plate>{formatPlate(data.vehicleSnapshot.registrationNumber)}</Plate>
              <DetailList
                items={[
                  { label: 'Type', value: VEHICLE_TYPE_LABEL[data.vehicleSnapshot.vehicleType] },
                  { label: 'Seats', value: data.vehicleSnapshot.seatingCapacity },
                ]}
              />
              <Badge tone="ink">Recorded at trip start</Badge>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title="Complete Trip"
        lead={`${data.startLocation} → ${data.destination}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteOpen(false)} disabled={complete.busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={complete.busy}
              onClick={async () => {
                const km = distance.trim() ? Number(distance) : undefined;
                const result = await complete.run(data.id, km);
                if (result) {
                  toast.success('Trip completed');
                  setCompleteOpen(false);
                  setDistance('');
                  trip.reload();
                }
              }}
            >
              Complete Trip
            </Button>
          </>
        }
      >
        <div className="stack">
          {complete.error ? <Alert tone="error">{complete.error.message}</Alert> : null}
          <Input
            label="Actual distance travelled (km)"
            type="number"
            min={0.1}
            step="0.1"
            value={distance}
            onChange={(event) => setDistance(event.target.value)}
            placeholder={String(data.distanceKm)}
            hint={`Leave blank to use the planned ${formatDistance(data.distanceKm)}.`}
            error={complete.error?.fieldErrors.distanceKm}
          />
          <Alert tone="info">
            The cost is split across {passengers.length} passenger
            {passengers.length === 1 ? '' : 's'} and recorded permanently against this trip.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Trip"
        message="The trip is closed with no distance or cost, and the ride is marked canceled. This cannot be undone."
        confirmLabel="Cancel Trip"
        cancelLabel="Keep driving"
        tone="danger"
        busy={cancel.busy}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async () => {
          const result = await cancel.run(data.id);
          if (result) {
            toast.success('Trip canceled');
            setCancelOpen(false);
            trip.reload();
          } else if (cancel.error) {
            toast.error(cancel.error.message);
          }
        }}
      >
        {cancel.error ? <Alert tone="error">{cancel.error.message}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
