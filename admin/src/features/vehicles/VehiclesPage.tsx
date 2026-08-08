import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { VEHICLE_STATUS, VEHICLE_TYPE, VEHICLE_TYPE_LABEL, formatDate } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  Icon,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Plate,
  SearchInput,
  Select,
  SkeletonTable,
  EmptyState,
  ErrorState,
  VehicleStatusBadge,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced, useMutation } from '../../lib/hooks';

const STATUS_OPTIONS = [
  { value: VEHICLE_STATUS.ACTIVE, label: 'Active' },
  { value: VEHICLE_STATUS.UNDER_REVIEW, label: 'Under review' },
  { value: VEHICLE_STATUS.INACTIVE, label: 'Inactive' },
];

const TYPE_OPTIONS = Object.values(VEHICLE_TYPE).map((value) => ({
  value,
  label: VEHICLE_TYPE_LABEL[value],
}));

const EMPTY_FORM = {
  ownerId: '',
  make: '',
  model: '',
  registrationNumber: '',
  vehicleType: 'sedan',
  seatingCapacity: '5',
  color: '',
};

export function VehiclesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [ownerId, setOwnerId] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const debouncedSearch = useDebounced(search);

  const drivers = useApi(() => api.admin.employees.list({ pageSize: 100, status: 'active' }), []);
  const vehicles = useApi(
    () =>
      api.admin.vehicles.list({
        search: debouncedSearch || undefined,
        status: status || undefined,
        ownerId: ownerId || undefined,
        page,
        pageSize: 10,
      }),
    [debouncedSearch, status, ownerId, page],
  );

  const create = useMutation((body: Record<string, unknown>) => api.admin.vehicles.create(body));

  const items = vehicles.data?.items ?? [];
  const pagination = vehicles.data?.pagination;

  const ownerOptions = (drivers.data?.items ?? []).map((employee) => ({
    value: employee.id,
    label: `${employee.name}${employee.department ? ` · ${employee.department}` : ''}`,
  }));

  async function submit() {
    const result = await create.run({
      ownerId: form.ownerId,
      make: form.make.trim(),
      model: form.model.trim(),
      registrationNumber: form.registrationNumber.trim(),
      vehicleType: form.vehicleType,
      seatingCapacity: Number(form.seatingCapacity),
      color: form.color.trim() || undefined,
    });
    if (result) {
      toast.success(`${result.make} ${result.model} registered`);
      setAddOpen(false);
      setForm(EMPTY_FORM);
      vehicles.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Vehicles"
        lead="The vehicle register. Only active vehicles can be selected for new rides."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
            Register vehicle
          </Button>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <SearchInput
              placeholder="Search by make, model or registration"
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
              setSearchParams(event.target.value ? { status: event.target.value } : {});
              setPage(1);
            }}
          />
          <Select
            label="Associated driver"
            options={ownerOptions}
            placeholder="All drivers"
            value={ownerId}
            onChange={(event) => {
              setOwnerId(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {vehicles.error ? (
          <ErrorState {...resolveErrorCopy(vehicles.error)} onRetry={vehicles.reload} />
        ) : vehicles.initialLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="car"
            title="No vehicles match these filters"
            text="Register a company vehicle, or ask employees to add their own from the employee app."
            action={
              <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
                Register vehicle
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table--clickable">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Registration</th>
                    <th>Driver</th>
                    <th className="is-numeric">Capacity</th>
                    <th>Status</th>
                    <th>Registered</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((vehicle) => (
                    <tr key={vehicle.id} onClick={() => navigate(`/vehicles/${vehicle.id}`)}>
                      <td>
                        <div className="row">
                          <span className="card-statistic__icon">
                            <Icon name="car" size={15} />
                          </span>
                          <span>
                            <div className="t-medium">
                              {vehicle.make} {vehicle.model}
                            </div>
                            <div className="t-caption">
                              {VEHICLE_TYPE_LABEL[vehicle.vehicleType]}
                              {vehicle.color ? ` · ${vehicle.color}` : ''}
                            </div>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Plate>{vehicle.registrationNumber}</Plate>
                      </td>
                      <td className="t-caption">{vehicle.ownerName}</td>
                      <td className="is-numeric">{vehicle.seatingCapacity}</td>
                      <td>
                        <VehicleStatusBadge status={vehicle.status} />
                      </td>
                      <td className="t-caption t-nowrap">{formatDate(vehicle.createdAt)}</td>
                      <td>
                        <div className="table__actions">
                          <Link className="btn btn-ghost btn-sm" to={`/vehicles/${vehicle.id}`} onClick={(e) => e.stopPropagation()}>
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
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPage={setPage}
                label="vehicles"
              />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register a vehicle"
        lead="Associate the vehicle with the employee who will drive it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={create.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={create.busy}>
              Register vehicle
            </Button>
          </>
        }
      >
        <div className="stack">
          {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
          <Select
            label="Associated employee"
            options={ownerOptions}
            placeholder="Select an employee"
            value={form.ownerId}
            onChange={(event) => setForm({ ...form, ownerId: event.target.value })}
            error={create.error?.fieldErrors.ownerId}
          />
          <div className="form-row">
            <Input
              label="Make"
              value={form.make}
              onChange={(event) => setForm({ ...form, make: event.target.value })}
              error={create.error?.fieldErrors.make}
              placeholder="Honda"
            />
            <Input
              label="Model"
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              error={create.error?.fieldErrors.model}
              placeholder="City"
            />
          </div>
          <div className="form-row">
            <Input
              label="Registration number"
              value={form.registrationNumber}
              onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
              error={create.error?.fieldErrors.registrationNumber}
              placeholder="WB 06 AK 4412"
              hint="Must be unique within your organization"
            />
            <Select
              label="Vehicle type"
              options={TYPE_OPTIONS}
              value={form.vehicleType}
              onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
            />
          </div>
          <div className="form-row">
            <Input
              label="Seating capacity"
              type="number"
              min={1}
              max={50}
              value={form.seatingCapacity}
              onChange={(event) => setForm({ ...form, seatingCapacity: event.target.value })}
              error={create.error?.fieldErrors.seatingCapacity}
              hint="Including the driver"
            />
            <Input
              label="Colour"
              optional
              value={form.color}
              onChange={(event) => setForm({ ...form, color: event.target.value })}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
