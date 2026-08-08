import { useState } from 'react';
import { VEHICLE_STATUS, VEHICLE_TYPE, VEHICLE_TYPE_LABEL, formatDate } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Plate,
  Select,
  SkeletonCards,
  VehicleStatusBadge,
  resolveErrorCopy,
  useToast,
  vehicleImage,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { isOperational, useAuth } from '../../lib/auth';

const EMPTY = {
  make: '',
  model: '',
  registrationNumber: '',
  vehicleType: 'sedan',
  seatingCapacity: '5',
  color: '',
};

export function VehiclesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const vehicles = useApi(() => api.employee.vehicles.list(), []);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [retireId, setRetireId] = useState<string | null>(null);

  const create = useMutation((body: Record<string, unknown>) => api.employee.vehicles.create(body));
  const setStatus = useMutation((id: string, status: string) =>
    api.employee.vehicles.setStatus(id, { status }),
  );

  const items = vehicles.data ?? [];

  async function submit() {
    const result = await create.run({
      make: form.make.trim(),
      model: form.model.trim(),
      registrationNumber: form.registrationNumber.trim(),
      vehicleType: form.vehicleType,
      seatingCapacity: Number(form.seatingCapacity),
      color: form.color.trim() || undefined,
    });
    if (result) {
      toast.success(
        result.status === VEHICLE_STATUS.UNDER_REVIEW
          ? 'Vehicle submitted for approval'
          : 'Vehicle registered and ready to use',
      );
      setAddOpen(false);
      setForm(EMPTY);
      vehicles.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="My vehicles"
        lead="Register the car you drive to work. An approved vehicle lets you publish rides."
        actions={
          <Button
            variant="primary"
            icon="plus"
            onClick={() => setAddOpen(true)}
            disabled={!isOperational(user)}
            title={isOperational(user) ? undefined : 'Your account cannot register vehicles right now'}
          >
            Register a vehicle
          </Button>
        }
      />

      {vehicles.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(vehicles.error)} onRetry={vehicles.reload} />
        </Card>
      ) : vehicles.initialLoading ? (
        <SkeletonCards count={2} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="car"
            title="No vehicles registered"
            text="You can ride as a passenger without a vehicle. Register one to start offering seats."
            action={
              <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)} disabled={!isOperational(user)}>
                Register a vehicle
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {items.map((vehicle) => (
            <article className="vehicle-card" key={vehicle.id}>
              <div className="vehicle-card__media">
                <img src={vehicleImage(vehicle.vehicleType)} alt={`${vehicle.make} ${vehicle.model}`} loading="lazy" />
                <span className="vehicle-card__status">
                  <VehicleStatusBadge status={vehicle.status} />
                </span>
              </div>
              <div className="vehicle-card__body">
                <div className="row-between">
                  <div>
                    <h2 className="t-subtitle">
                      {vehicle.make} {vehicle.model}
                    </h2>
                    <p className="t-caption">
                      {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {vehicle.seatingCapacity} seats
                      {vehicle.color ? ` · ${vehicle.color}` : ''}
                    </p>
                  </div>
                  <Plate>{vehicle.registrationNumber}</Plate>
                </div>

                <div className="road-rule" />

                <p className="t-caption">
                  Registered {formatDate(vehicle.createdAt)} · you can offer up to{' '}
                  {Math.max(1, vehicle.seatingCapacity - 1)} seats
                </p>

                {vehicle.status === VEHICLE_STATUS.UNDER_REVIEW ? (
                  <Alert tone="warning">
                    Waiting for administrator approval. You cannot publish rides with it yet.
                  </Alert>
                ) : vehicle.status === VEHICLE_STATUS.INACTIVE ? (
                  <Alert tone="info">Retired. Past trips with this vehicle are preserved.</Alert>
                ) : null}

                <div className="row">
                  {vehicle.status === VEHICLE_STATUS.ACTIVE ? (
                    <Button variant="secondary" size="sm" onClick={() => setRetireId(vehicle.id)}>
                      Retire vehicle
                    </Button>
                  ) : vehicle.status === VEHICLE_STATUS.INACTIVE ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={setStatus.busy}
                      onClick={async () => {
                        const result = await setStatus.run(vehicle.id, VEHICLE_STATUS.UNDER_REVIEW);
                        if (result) {
                          toast.info('Sent back for administrator approval');
                          vehicles.reload();
                        } else if (setStatus.error) {
                          toast.error(setStatus.error.message);
                        }
                      }}
                    >
                      Request re-approval
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Card style={{ marginTop: 'var(--space-4)' }}>
        <CardBody tight>
          <p className="t-caption">
            <Icon name="shield" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
            Only an administrator can approve a vehicle for use. Registration numbers are unique within your
            organization.
          </p>
        </CardBody>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register a vehicle"
        lead="Your administrator may need to approve it before you can publish rides."
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
          <div className="form-row">
            <Input
              label="Make"
              value={form.make}
              onChange={(event) => setForm({ ...form, make: event.target.value })}
              error={create.error?.fieldErrors.make}
              placeholder="Honda"
              autoFocus
            />
            <Input
              label="Model"
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              error={create.error?.fieldErrors.model}
              placeholder="City"
            />
          </div>
          <Input
            label="Registration number"
            value={form.registrationNumber}
            onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
            error={create.error?.fieldErrors.registrationNumber}
            placeholder="WB 06 AK 4412"
          />
          <div className="form-row">
            <Select
              label="Vehicle type"
              options={Object.values(VEHICLE_TYPE).map((value) => ({ value, label: VEHICLE_TYPE_LABEL[value] }))}
              value={form.vehicleType}
              onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
            />
            <Input
              label="Seats (including you)"
              type="number"
              min={1}
              max={50}
              value={form.seatingCapacity}
              onChange={(event) => setForm({ ...form, seatingCapacity: event.target.value })}
              error={create.error?.fieldErrors.seatingCapacity}
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

      <ConfirmDialog
        open={retireId !== null}
        title="Retire this vehicle?"
        message="You will not be able to publish new rides with it. Your past trips are unaffected."
        confirmLabel="Retire vehicle"
        cancelLabel="Keep it active"
        tone="danger"
        busy={setStatus.busy}
        onCancel={() => setRetireId(null)}
        onConfirm={async () => {
          if (!retireId) return;
          const result = await setStatus.run(retireId, VEHICLE_STATUS.INACTIVE);
          if (result) {
            toast.success('Vehicle retired');
            setRetireId(null);
            vehicles.reload();
          } else if (setStatus.error) {
            toast.error(setStatus.error.message);
          }
        }}
      />
    </>
  );
}
