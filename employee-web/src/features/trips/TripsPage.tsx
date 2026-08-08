import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatDistance, formatMoney, formatNumber } from '@carpool/shared';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  RouteInline,
  SkeletonTable,
  Stat,
  TripStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'in_progress', label: 'In progress' },
] as const;

export function TripsPage() {
  const [filter, setFilter] = useState<string>('all');
  const trips = useApi(() => api.employee.trips.list(), []);

  const all = trips.data ?? [];
  const items = filter === 'all' ? all : all.filter((trip) => trip.status === filter);

  const completed = all.filter((trip) => trip.status === 'completed');
  const totalDistance = completed.reduce((sum, trip) => sum + trip.distanceKm, 0);
  const myCost = completed.reduce((sum, trip) => sum + (trip.viewerShare ?? 0), 0);
  const asDriver = completed.filter((trip) => trip.viewerRole === 'driver').length;

  return (
    <>
      <PageHeader title="Trips" lead="Every journey you have driven or ridden, with its distance and your share." />

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
            <Stat label="Completed trips" value={formatNumber(completed.length)} icon="route" accent small />
            <Stat label="Distance shared" value={formatDistance(totalDistance)} icon="trend" small />
            <Stat label="As driver" value={formatNumber(asDriver)} icon="car" small />
            <Stat label="Your total share" value={formatMoney(myCost)} icon="wallet" small />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            <div className="filter-bar">
              <div className="form-group">
                <span className="form-label">Show</span>
                <div className="btn-group">
                  {FILTERS.map((option) => (
                    <button
                      key={option.value}
                      className={filter === option.value ? 'is-active' : undefined}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon="history"
                title={filter === 'all' ? 'No trips yet' : `No ${filter.replace('_', ' ')} trips`}
                text="A trip is created when a driver starts a ride. Completed trips carry the distance, fuel and cost."
                action={
                  <Link className="btn btn-primary" to="/rides">
                    Find a ride
                  </Link>
                }
              />
            ) : (
              <div className="table-responsive">
                <table className="table table--clickable">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Your role</th>
                      <th>Status</th>
                      <th className="is-numeric">Distance</th>
                      <th className="is-numeric">Your share</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((trip) => (
                      <tr key={trip.id}>
                        <td>
                          <RouteInline from={trip.startLocation} to={trip.destination} />
                          <div className="t-caption">
                            {trip.vehicleSnapshot.make} {trip.vehicleSnapshot.model} ·{' '}
                            {trip.participants.length} on board
                          </div>
                        </td>
                        <td className="t-caption">{trip.viewerRole === 'driver' ? 'Driver' : 'Passenger'}</td>
                        <td>
                          <TripStatusBadge status={trip.status} />
                        </td>
                        <td className="is-numeric">{formatDistance(trip.distanceKm)}</td>
                        <td className="is-numeric">
                          {trip.viewerShare !== null ? formatMoney(trip.viewerShare, trip.currency) : '—'}
                        </td>
                        <td className="t-caption t-nowrap">{formatDate(trip.completedAt ?? trip.startedAt)}</td>
                        <td>
                          <div className="table__actions">
                            <Link className="btn btn-ghost btn-sm" to={`/trips/${trip.id}`}>
                              Open
                              <Icon name="arrowRight" size={13} />
                            </Link>
                          </div>
                        </td>
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
