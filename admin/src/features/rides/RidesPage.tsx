import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RIDE_STATUS, formatDate, formatDateTime, type AdminRideRow } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  PageHeader,
  Pagination,
  Plate,
  RideStatusBadge,
  RouteInline,
  SearchInput,
  Select,
  SkeletonTable,
  Textarea,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced, useMutation } from '../../lib/hooks';

const STATUS_OPTIONS = [
  { value: RIDE_STATUS.PUBLISHED, label: 'Published' },
  { value: RIDE_STATUS.FULL, label: 'Full' },
  { value: RIDE_STATUS.IN_PROGRESS, label: 'In progress' },
  { value: RIDE_STATUS.COMPLETED, label: 'Completed' },
  { value: RIDE_STATUS.CANCELED, label: 'Canceled' },
];

/**
 * Every ride in the organization. An administrator monitors here and may pull
 * an unsafe ride — publishing and booking stay with the employee panels, so
 * there is deliberately no "publish" action on this screen.
 */
export function RidesPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<AdminRideRow | null>(null);

  const debouncedSearch = useDebounced(search);

  const drivers = useApi(() => api.admin.drivers.list({ pageSize: 100 }), []);
  const vehicles = useApi(() => api.admin.vehicles.list({ pageSize: 100 }), []);
  const rides = useApi(
    () =>
      api.admin.rides.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
        date: date || undefined,
        page,
        pageSize: 10,
      }),
    [debouncedSearch, status, driverId, vehicleId, date, page],
  );

  const items = rides.data?.items ?? [];
  const pagination = rides.data?.pagination;

  const driverOptions = (drivers.data?.items ?? []).map((driver) => ({
    value: driver.employeeId,
    label: driver.name,
  }));
  const vehicleOptions = (vehicles.data?.items ?? []).map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`,
  }));

  function clearFilters() {
    setSearch('');
    setStatus('');
    setDriverId('');
    setVehicleId('');
    setDate('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Rides"
        lead="Every ride published in your organization, filterable by driver, vehicle, date and status."
        actions={
          <Button variant="secondary" icon="refresh" onClick={rides.reload} loading={rides.loading}>
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <SearchInput
              placeholder="Search by route, driver or registration"
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
          <Select
            label="Driver"
            options={driverOptions}
            placeholder="All drivers"
            value={driverId}
            onChange={(event) => {
              setDriverId(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Vehicle"
            options={vehicleOptions}
            placeholder="All vehicles"
            value={vehicleId}
            onChange={(event) => {
              setVehicleId(event.target.value);
              setPage(1);
            }}
          />
          <div className="form-group">
            <label className="form-label" htmlFor="admin-rides-date">
              Date
            </label>
            <input
              id="admin-rides-date"
              type="date"
              className="form-control"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        {rides.error ? (
          <ErrorState {...resolveErrorCopy(rides.error)} onRetry={rides.reload} />
        ) : rides.initialLoading ? (
          <SkeletonTable rows={8} columns={7} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="route"
            title="No rides match these filters"
            text="Rides appear here as soon as a driver publishes one."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Route</th>
                    <th>Ride status</th>
                    <th className="is-numeric">Passengers</th>
                    <th>Organization</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((ride) => (
                    <tr key={ride.id} onClick={() => navigate(`/admin/rides/${ride.id}`)}>
                      <td>
                        <div className="t-medium">{ride.driver.name}</div>
                        <div className="t-caption">{ride.driver.department ?? 'No department'}</div>
                      </td>
                      <td>
                        <div className="t-caption">
                          {ride.vehicle.make} {ride.vehicle.model}
                        </div>
                        <Plate>{ride.vehicle.registrationNumber}</Plate>
                      </td>
                      <td>
                        <RouteInline from={ride.startLocation} to={ride.destination} />
                        <div className="t-caption">{formatDateTime(ride.departureAt)}</div>
                      </td>
                      <td>
                        <RideStatusBadge status={ride.status} />
                      </td>
                      <td className="is-numeric">
                        <div className="t-medium">{ride.passengerCount}</div>
                        <div className="t-caption">of {ride.totalSeats} seats</div>
                      </td>
                      <td className="t-caption">{ride.organizationName}</td>
                      <td className="t-caption t-nowrap">{formatDate(ride.createdAt)}</td>
                      <td>
                        <div className="table__actions">
                          <Link
                            className="btn btn-ghost btn-sm"
                            to={`/admin/rides/${ride.id}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            Open
                            <Icon name="arrowRight" size={13} />
                          </Link>
                          {ride.status === RIDE_STATUS.PUBLISHED || ride.status === RIDE_STATUS.FULL ? (
                            <Button
                              variant="danger-outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                setCancelTarget(ride);
                              }}
                            >
                              Cancel Ride
                            </Button>
                          ) : null}
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
                label="rides"
              />
            ) : null}
          </>
        )}
      </Card>

      <CancelRideDialog
        ride={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={() => {
          setCancelTarget(null);
          toast.success('Ride canceled');
          rides.reload();
        }}
      />
    </>
  );
}

export function CancelRideDialog({
  ride,
  onClose,
  onDone,
}: {
  ride: { id: string; startLocation: string; destination: string; passengerCount: number } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useMutation((id: string, note?: string) => api.admin.rides.cancel(id, note));

  if (!ride) return null;

  async function confirm() {
    const result = await mutation.run(ride!.id, reason.trim() || undefined);
    if (result) {
      setReason('');
      onDone();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel Ride"
      lead={`${ride.startLocation} → ${ride.destination}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} loading={mutation.busy}>
            Cancel Ride
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <Alert tone="warning">
          {ride.passengerCount > 0
            ? `${ride.passengerCount} confirmed passenger${ride.passengerCount === 1 ? '' : 's'} will lose their seat.`
            : 'Any open seat requests on this ride will be canceled.'}
        </Alert>
        <Textarea
          label="Reason"
          optional
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Vehicle reported unsafe"
        />
        <Alert tone="info">This action is recorded in the audit log.</Alert>
      </div>
    </Modal>
  );
}
