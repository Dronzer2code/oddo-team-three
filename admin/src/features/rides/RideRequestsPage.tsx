import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RIDE_REQUEST_STATUS, formatDateTime } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  PageHeader,
  Pagination,
  RequestStatusBadge,
  RouteInline,
  SearchInput,
  Select,
  SkeletonTable,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';

const STATUS_OPTIONS = [
  { value: RIDE_REQUEST_STATUS.PENDING, label: 'Pending' },
  { value: RIDE_REQUEST_STATUS.ACCEPTED, label: 'Accepted' },
  { value: RIDE_REQUEST_STATUS.REJECTED, label: 'Rejected' },
  { value: RIDE_REQUEST_STATUS.CANCELED, label: 'Canceled' },
];

/**
 * Seat requests across every ride. Read-only on purpose: accepting or
 * rejecting a request is the driver's decision, and an administrator taking it
 * for them would break the separation the platform depends on.
 */
export function RideRequestsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);

  const requests = useApi(
    () =>
      api.admin.rideRequests.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        pageSize: 15,
      }),
    [debouncedSearch, status, page],
  );

  const items = requests.data?.items ?? [];
  const pagination = requests.data?.pagination;

  return (
    <>
      <PageHeader
        title="Ride Requests"
        lead="Every seat request in your organization and where it stands."
        actions={
          <Button variant="secondary" icon="refresh" onClick={requests.reload} loading={requests.loading}>
            Refresh
          </Button>
        }
      />

      <Alert tone="info">
        Accepting or rejecting a request is the driver's decision. This view is for monitoring only.
      </Alert>

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <SearchInput
              placeholder="Search by passenger, driver or route"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {requests.error ? (
          <ErrorState {...resolveErrorCopy(requests.error)} onRetry={requests.reload} />
        ) : requests.initialLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="seat"
            title="No seat requests match these filters"
            text="Requests appear here as soon as a passenger asks to join a ride."
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Passenger</th>
                    <th>Employee ID</th>
                    <th>Ride</th>
                    <th>Driver</th>
                    <th className="is-numeric">Seats requested</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <Identity
                          name={request.passengerName}
                          meta={request.passengerDepartment ?? 'No department'}
                          size="sm"
                        />
                      </td>
                      <td className="t-caption">{request.passengerEmployeeCode ?? '—'}</td>
                      <td>
                        <RouteInline from={request.startLocation} to={request.destination} />
                        <div className="t-caption">{formatDateTime(request.departureAt)}</div>
                      </td>
                      <td className="t-caption">{request.driverName}</td>
                      <td className="is-numeric">{request.seats}</td>
                      <td>
                        <RequestStatusBadge status={request.status} />
                      </td>
                      <td className="t-caption t-nowrap">{formatDateTime(request.createdAt)}</td>
                      <td>
                        <div className="table__actions">
                          <Link className="btn btn-ghost btn-sm" to={`/admin/rides/${request.rideId}`}>
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
                label="requests"
              />
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}
