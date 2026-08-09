import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime, formatDistance, formatMoney, formatNumber, formatRelative } from '@carpool/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  Pagination,
  Plate,
  RouteInline,
  SearchInput,
  SkeletonTable,
  TripStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';

/**
 * Active Trips and Completed Trips are the same record at two points in its
 * life, so they share one table and differ only in the columns that carry
 * meaning at that point — an active trip has no cost yet, a completed one does.
 */
export function TripsTable({
  variant,
  title,
  lead,
  emptyTitle,
  emptyText,
}: {
  variant: 'active' | 'completed';
  title: string;
  lead: string;
  emptyTitle: string;
  emptyText: string;
}) {
  const [search, setSearch] = useState('');
  const [driverId, setDriverId] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);

  const drivers = useApi(() => api.admin.drivers.list({ pageSize: 100 }), []);
  const trips = useApi(
    () => {
      const query = { search: debouncedSearch || undefined, driverId: driverId || undefined, page, pageSize: 15 };
      return variant === 'active' ? api.admin.trips.active(query) : api.admin.trips.completed(query);
    },
    [variant, debouncedSearch, driverId, page],
  );

  const items = trips.data?.items ?? [];
  const pagination = trips.data?.pagination;
  const completed = variant === 'completed';

  return (
    <>
      <PageHeader
        title={title}
        lead={lead}
        actions={
          <Button variant="secondary" icon="refresh" onClick={trips.reload} loading={trips.loading}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <SearchInput
              placeholder="Search by route or driver"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            className="form-control"
            aria-label="Driver"
            value={driverId}
            onChange={(event) => {
              setDriverId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All drivers</option>
            {(drivers.data?.items ?? []).map((driver) => (
              <option key={driver.employeeId} value={driver.employeeId}>
                {driver.name}
              </option>
            ))}
          </select>
        </div>

        {trips.error ? (
          <ErrorState {...resolveErrorCopy(trips.error)} onRetry={trips.reload} />
        ) : trips.initialLoading ? (
          <SkeletonTable rows={8} columns={7} />
        ) : items.length === 0 ? (
          <EmptyState icon={completed ? 'flag' : 'play'} title={emptyTitle} text={emptyText} />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Route</th>
                    <th className="is-numeric">Passengers</th>
                    <th className="is-numeric">Distance</th>
                    {completed ? <th className="is-numeric">Fuel</th> : null}
                    {completed ? <th className="is-numeric">Total cost</th> : null}
                    {completed ? <th className="is-numeric">Cost per km</th> : null}
                    <th>Status</th>
                    <th>{completed ? 'Completed' : 'Started'}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((trip) => (
                    <tr key={trip.id}>
                      <td className="t-medium">{trip.driverName}</td>
                      <td>
                        <div className="t-caption">{trip.vehicleLabel}</div>
                        <Plate>{trip.registrationNumber}</Plate>
                      </td>
                      <td>
                        <RouteInline from={trip.startLocation} to={trip.destination} />
                      </td>
                      <td className="is-numeric">{trip.passengerCount}</td>
                      <td className="is-numeric">{formatDistance(trip.distanceKm)}</td>
                      {completed ? (
                        <td className="is-numeric">{formatNumber(trip.fuelConsumedLitres, 1)} L</td>
                      ) : null}
                      {completed ? (
                        <td className="is-numeric">{formatMoney(trip.totalCost, trip.currency)}</td>
                      ) : null}
                      {completed ? (
                        <td className="is-numeric">{formatMoney(trip.costPerKm, trip.currency, 2)}</td>
                      ) : null}
                      <td>
                        <TripStatusBadge status={trip.status} />
                      </td>
                      <td className="t-caption t-nowrap">
                        {completed ? (
                          formatDateTime(trip.completedAt)
                        ) : (
                          <>
                            {formatDateTime(trip.startedAt)}
                            <div>{formatRelative(trip.startedAt)}</div>
                          </>
                        )}
                      </td>
                      <td>
                        <div className="table__actions">
                          <Link className="btn btn-ghost btn-sm" to={`/admin/rides/${trip.rideId}`}>
                            View ride
                            <Icon name="arrowRight" size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPage={setPage}
                label="trips"
              />
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
