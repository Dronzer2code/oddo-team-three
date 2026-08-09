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
 * Passenger trip history. Only trips this employee actually rode on — trips
 * they drove belong to the Driver panel's own history.
 */
export function PassengerHistoryPage() {
  const trips = useApi(() => api.employee.trips.list(), []);

  const ridden = (trips.data ?? []).filter((trip) => trip.viewerRole === 'passenger');
  const completed = ridden.filter((trip) => trip.status === 'completed');
  const distance = completed.reduce((sum, trip) => sum + trip.distanceKm, 0);
  const spend = completed.reduce((sum, trip) => sum + (trip.viewerShare ?? 0), 0);

  return (
    <>
      <PageHeader title="History" lead="Every trip you have ridden, with its distance and your share." />

      {trips.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(trips.error)} onRetry={trips.reload} />
        </Card>
      ) : trips.initialLoading ? (
        <Card>
          <SkeletonTable rows={6} columns={5} />
        </Card>
      ) : (
        <>
          <div className="grid grid-4">
            <Stat label="Trips completed" value={formatNumber(completed.length)} icon="route" accent small />
            <Stat label="Distance travelled" value={formatDistance(distance)} icon="trend" small />
            <Stat label="Your total cost" value={formatMoney(spend)} icon="wallet" small />
            <Stat label="Trips recorded" value={formatNumber(ridden.length)} icon="history" small />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            {ridden.length === 0 ? (
              <EmptyState
                icon="history"
                title="No trips yet"
                text="Once a driver completes a ride you were on, it lands here with its distance and cost."
                action={
                  <Link className="btn btn-primary" to="/passenger/rides">
                    Find a Ride
                  </Link>
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Driver</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th className="is-numeric">Distance</th>
                      <th className="is-numeric">Your cost</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ridden.map((trip) => (
                      <tr key={trip.id}>
                        <td>
                          <RouteInline from={trip.startLocation} to={trip.destination} />
                        </td>
                        <td className="t-caption">{trip.driverName}</td>
                        <td>
                          <div className="t-caption">
                            {trip.vehicleSnapshot.make} {trip.vehicleSnapshot.model}
                          </div>
                          <Plate>{trip.vehicleSnapshot.registrationNumber}</Plate>
                        </td>
                        <td>
                          <TripStatusBadge status={trip.status} />
                        </td>
                        <td className="is-numeric">{formatDistance(trip.distanceKm)}</td>
                        <td className="is-numeric">
                          {trip.viewerShare !== null ? formatMoney(trip.viewerShare, trip.currency) : '—'}
                        </td>
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
