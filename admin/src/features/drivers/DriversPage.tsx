import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistance, formatNumber } from '@carpool/shared';
import {
  AccountStatusBadge,
  Alert,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  Pagination,
  ParticipationBadge,
  Plate,
  SkeletonTable,
  VehicleStatusBadge,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/**
 * Drivers are a derived view — an employee plus the vehicles they own. There is
 * no driver account type in the platform.
 */
export function DriversPage() {
  const [page, setPage] = useState(1);
  const drivers = useApi(() => api.admin.drivers.list({ page, pageSize: 10 }), [page]);

  const items = drivers.data?.items ?? [];
  const pagination = drivers.data?.pagination;

  return (
    <>
      <PageHeader
        title="Drivers"
        lead="Employees who own at least one vehicle. Employee + vehicle = driver — there is no separate driver account."
      />

      <Alert tone="info" className="animate-in">
        <span>
          A driver is also a passenger on somebody else&apos;s ride. Access is controlled from{' '}
          <Link to="/employees" className="t-medium">
            Employees
          </Link>
          , and vehicle approval from{' '}
          <Link to="/vehicles" className="t-medium">
            Vehicles
          </Link>
          .
        </span>
      </Alert>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        {drivers.error ? (
          <ErrorState {...resolveErrorCopy(drivers.error)} onRetry={drivers.reload} />
        ) : drivers.initialLoading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="user"
            title="No drivers yet"
            text="As soon as an employee registers a vehicle they appear here as a driver."
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Account</th>
                    <th>Vehicles</th>
                    <th className="is-numeric">Capacity</th>
                    <th className="is-numeric">Rides / Trips</th>
                    <th className="is-numeric">Distance</th>
                    <th>Participation</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((driver) => (
                    <tr key={driver.employeeId}>
                      <td>
                        <Link to={`/employees/${driver.employeeId}`}>
                          <Identity name={driver.name} meta={driver.department ?? '—'} />
                        </Link>
                      </td>
                      <td>
                        <AccountStatusBadge status={driver.accountStatus} />
                      </td>
                      <td>
                        <div className="stack-sm">
                          {driver.vehicles.map((vehicle) => (
                            <div className="row" key={vehicle.id} style={{ gap: 'var(--space-2)' }}>
                              <Icon name="car" size={14} />
                              <Link to={`/vehicles/${vehicle.id}`} className="t-caption t-medium">
                                {vehicle.label}
                              </Link>
                              <Plate>{vehicle.registrationNumber}</Plate>
                              <VehicleStatusBadge status={vehicle.status} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="is-numeric">{formatNumber(driver.totalCapacity)}</td>
                      <td className="is-numeric">
                        {formatNumber(driver.ridesPublished)} / {formatNumber(driver.tripsCompleted)}
                      </td>
                      <td className="is-numeric">{formatDistance(driver.distanceKm)}</td>
                      <td>
                        <ParticipationBadge active={driver.isActiveParticipant} />
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
                label="drivers"
              />
            ) : null}
          </>
        )}
      </Card>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody tight>
          <p className="t-caption">
            Capacity counts seats on active vehicles only. A driver with a vehicle under review cannot publish
            rides until an administrator approves it.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
