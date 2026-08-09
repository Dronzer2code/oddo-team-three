import { Link } from 'react-router-dom';
import { formatDate, formatDistance, formatMoney, formatNumber } from '@carpool/shared';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Plate,
  RouteInline,
  SkeletonTable,
  Stat,
  TripStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/**
 * Driver trip history. Only trips this employee drove — the distance, fuel and
 * cost shown are the figures recorded at completion, not recalculated.
 */
export function DriverHistoryPage() {
  const trips = useApi(() => api.employee.trips.list(), []);

  const driven = (trips.data ?? []).filter((trip) => trip.viewerRole === 'driver');
  const completed = driven.filter((trip) => trip.status === 'completed');
  const distance = completed.reduce((sum, trip) => sum + trip.distanceKm, 0);
  const fuel = completed.reduce((sum, trip) => sum + trip.fuelConsumedLitres, 0);
  const recovered = completed.reduce((sum, trip) => sum + (trip.totalCost - (trip.viewerShare ?? 0)), 0);

  return (
    <>
      <PageHeader
        title="Trip History"
        lead="Every trip you have driven, with the distance, fuel and cost recorded at completion."
      />

      {trips.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(trips.error)} onRetry={trips.reload} />
        </Card>
      ) : trips.initialLoading ? (
        <Card>
          <SkeletonTable rows={6} columns={6} />
        </Card>
      ) : (
        <>
          <div className="grid grid-4">
            <Stat label="Trips completed" value={formatNumber(completed.length)} icon="route" accent small />
            <Stat label="Distance driven" value={formatDistance(distance)} icon="trend" small />
            <Stat label="Fuel consumed" value={`${formatNumber(fuel, 1)} L`} icon="fuel" small />
            <Stat label="Cost recovered" value={formatMoney(recovered)} icon="wallet" small />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            {driven.length === 0 ? (
              <EmptyState
                icon="history"
                title="No trips yet"
                text="Start one of your published rides and complete it — the record lands here."
                action={
                  <Link className="btn btn-primary" to="/driver/rides">
                    My Rides
                  </Link>
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Vehicle</th>
                      <th className="is-numeric">Passengers</th>
                      <th>Status</th>
                      <th className="is-numeric">Distance</th>
                      <th className="is-numeric">Fuel</th>
                      <th className="is-numeric">Total cost</th>
                      <th className="is-numeric">Cost per km</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driven.map((trip) => (
                      <tr key={trip.id}>
                        <td>
                          <RouteInline from={trip.startLocation} to={trip.destination} />
                        </td>
                        <td>
                          <div className="t-caption">
                            {trip.vehicleSnapshot.make} {trip.vehicleSnapshot.model}
                          </div>
                          <Plate>{trip.vehicleSnapshot.registrationNumber}</Plate>
                        </td>
                        <td className="is-numeric">
                          {trip.participants.filter((participant) => participant.role === 'passenger').length}
                        </td>
                        <td>
                          <TripStatusBadge status={trip.status} />
                        </td>
                        <td className="is-numeric">{formatDistance(trip.distanceKm)}</td>
                        <td className="is-numeric">{formatNumber(trip.fuelConsumedLitres, 1)} L</td>
                        <td className="is-numeric">{formatMoney(trip.totalCost, trip.currency)}</td>
                        <td className="is-numeric">{formatMoney(trip.costPerKm, trip.currency, 2)}</td>
                        <td className="t-caption t-nowrap">{formatDate(trip.completedAt ?? trip.startedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
