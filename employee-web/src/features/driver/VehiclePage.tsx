import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  VEHICLE_STATUS,
  VEHICLE_STATUS_LABEL,
  VEHICLE_TYPE,
  VEHICLE_TYPE_LABEL,
  formatDate,
  type Vehicle,
} from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  DetailList,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Plate,
  Select,
  SkeletonCards,
  Textarea,
  VehicleStatusBadge,
  resolveErrorCopy,
  useToast,
  vehicleImage,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { isOperational, useAuth } from '../../lib/auth';
import { usePanelAccess } from '../../lib/panels';

/**
 * My Vehicle. Shows every field the platform contract lists — model,
 * registration, type, colour, capacity, approval status, vehicle status,
 * published ride count and completed trip count — and the three actions.
 */
export function DriverVehiclePage() {
  const toast = useToast();
  const { user } = useAuth();
  const panel = usePanelAccess();

  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const rides = useApi(() => api.employee.rides.mine(), []);
  const trips = useApi(() => api.employee.trips.list(), []);

  const [editTarget, setEditTarget] = useState<Vehicle | null>(null);
  const [documentTarget, setDocumentTarget] = useState<Vehicle | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const setStatus = useMutation((id: string, status: string) =>
    api.employee.vehicles.setStatus(id, { status }),
  );

  const items = vehicles.data ?? [];
  const driving = rides.data?.driving ?? [];
  const drivenTrips = (trips.data ?? []).filter((trip) => trip.viewerRole === 'driver');

  function ridesFor(vehicleId: string) {
    return driving.filter((ride) => ride.vehicle.id === vehicleId).length;
  }

  function tripsFor(vehicleId: string) {
    return drivenTrips.filter(
      (trip) => trip.status === 'completed' && trip.vehicleSnapshot.id === vehicleId,
    ).length;
  }

  return (
    <>
      <PageHeader
        title="My Vehicle"
        lead="Only an approved active vehicle may be used for new rides."
        actions={
          <Link
            className="btn btn-primary"
            to="/driver/vehicle/register"
            aria-disabled={!isOperational(user)}
          >
            <Icon name="plus" size={16} />
            Register Vehicle
          </Link>
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
            text="Register a vehicle and submit it for approval to start publishing rides."
            action={
              <Link className="btn btn-primary" to="/driver/vehicle/register">
                <Icon name="plus" size={16} />
                Register Vehicle
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cards-sm">
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
                    <p className="t-caption">Registered {formatDate(vehicle.createdAt)}</p>
                  </div>
                  <Plate>{vehicle.registrationNumber}</Plate>
                </div>

                <div className="road-rule" />

                <DetailList
                  items={[
                    { label: 'Model', value: `${vehicle.make} ${vehicle.model}` },
                    { label: 'Registration number', value: vehicle.registrationNumber },
                    { label: 'Type', value: VEHICLE_TYPE_LABEL[vehicle.vehicleType] },
                    { label: 'Color', value: vehicle.color ?? '—' },
                    { label: 'Capacity', value: `${vehicle.seatingCapacity} seats` },
                    {
                      label: 'Approval status',
                      value:
                        vehicle.status === VEHICLE_STATUS.UNDER_REVIEW
                          ? 'Pending'
                          : vehicle.status === VEHICLE_STATUS.ACTIVE
                            ? 'Approved'
                            : 'Not approved',
                    },
                    { label: 'Vehicle status', value: VEHICLE_STATUS_LABEL[vehicle.status] },
                    { label: 'Published ride count', value: ridesFor(vehicle.id) },
                    { label: 'Completed trip count', value: tripsFor(vehicle.id) },
                  ]}
                />

                {vehicle.status === VEHICLE_STATUS.UNDER_REVIEW ? (
                  <Alert tone="warning">
                    Waiting for administrator approval. You cannot publish rides with it yet.
                  </Alert>
                ) : vehicle.status === VEHICLE_STATUS.INACTIVE ? (
                  <Alert tone="info">
                    Deactivated. Past trips with this vehicle are preserved — submit documents to have it
                    reviewed again.
                  </Alert>
                ) : (
                  <Alert tone="success">
                    Approved and active. You can publish rides with this vehicle.
                  </Alert>
                )}

                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditTarget(vehicle)}>
                    Edit Vehicle
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="upload"
                    onClick={() => setDocumentTarget(vehicle)}
                  >
                    Submit Documents
                  </Button>
                  {vehicle.status === VEHICLE_STATUS.ACTIVE ? (
                    <Button variant="danger-outline" size="sm" onClick={() => setDeactivateId(vehicle.id)}>
                      Deactivate Vehicle
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

      <EditVehicleModal
        vehicle={editTarget}
        onClose={() => setEditTarget(null)}
        onDone={() => {
          setEditTarget(null);
          toast.success('Vehicle updated');
          vehicles.reload();
          panel.reload();
        }}
      />

      <SubmitDocumentsModal
        vehicle={documentTarget}
        onClose={() => setDocumentTarget(null)}
        onDone={() => {
          setDocumentTarget(null);
          toast.success('Sent to your administrator for review');
          vehicles.reload();
          panel.reload();
        }}
      />

      <ConfirmDialog
        open={deactivateId !== null}
        title="Deactivate this vehicle?"
        message="You will not be able to publish new rides with it. Your past trips are unaffected."
        confirmLabel="Deactivate Vehicle"
        cancelLabel="Keep it active"
        tone="danger"
        busy={setStatus.busy}
        onCancel={() => setDeactivateId(null)}
        onConfirm={async () => {
          if (!deactivateId) return;
          const result = await setStatus.run(deactivateId, VEHICLE_STATUS.INACTIVE);
          if (result) {
            toast.success('Vehicle deactivated');
            setDeactivateId(null);
            vehicles.reload();
            panel.reload();
          } else if (setStatus.error) {
            toast.error(setStatus.error.message);
          }
        }}
      />
    </>
  );
}

function EditVehicleModal({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    make: '',
    model: '',
    registrationNumber: '',
    vehicleType: 'sedan',
    seatingCapacity: '5',
    color: '',
  });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const update = useMutation((id: string, body: Record<string, unknown>) =>
    api.employee.vehicles.update(id, body),
  );

  if (!vehicle) return null;

  // Seed the form from the vehicle the first time this one is opened.
  if (loadedFor !== vehicle.id) {
    setLoadedFor(vehicle.id);
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType,
      seatingCapacity: String(vehicle.seatingCapacity),
      color: vehicle.color ?? '',
    });
  }

  async function submit() {
    const result = await update.run(vehicle!.id, {
      make: form.make.trim(),
      model: form.model.trim(),
      registrationNumber: form.registrationNumber.trim(),
      vehicleType: form.vehicleType,
      seatingCapacity: Number(form.seatingCapacity),
      color: form.color.trim() || undefined,
    });
    if (result) onDone();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Vehicle"
      lead={`${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={update.busy}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="stack">
        {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
        <div className="form-row">
          <Input
            label="Make"
            value={form.make}
            onChange={(event) => setForm({ ...form, make: event.target.value })}
            error={update.error?.fieldErrors.make}
          />
          <Input
            label="Model"
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            error={update.error?.fieldErrors.model}
          />
        </div>
        <Input
          label="Registration number"
          value={form.registrationNumber}
          onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
          error={update.error?.fieldErrors.registrationNumber}
        />
        <div className="form-row">
          <Select
            label="Vehicle type"
            options={Object.values(VEHICLE_TYPE).map((value) => ({
              value,
              label: VEHICLE_TYPE_LABEL[value],
            }))}
            value={form.vehicleType}
            onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
          />
          <Input
            label="Seating capacity"
            type="number"
            min={1}
            max={50}
            value={form.seatingCapacity}
            onChange={(event) => setForm({ ...form, seatingCapacity: event.target.value })}
            error={update.error?.fieldErrors.seatingCapacity}
          />
          <Input
            label="Color"
            optional
            value={form.color}
            onChange={(event) => setForm({ ...form, color: event.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}

/**
 * Submitting documents puts the vehicle back in the administrator's review
 * queue — that is the state change the platform actually models, and the note
 * travels on the audit record.
 */
function SubmitDocumentsModal({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const submitForReview = useMutation((id: string, reason: string) =>
    api.employee.vehicles.setStatus(id, { status: VEHICLE_STATUS.UNDER_REVIEW, reason }),
  );

  if (!vehicle) return null;

  const alreadyUnderReview = vehicle.status === VEHICLE_STATUS.UNDER_REVIEW;

  async function submit() {
    const result = await submitForReview.run(vehicle!.id, note.trim());
    if (result) {
      setNote('');
      onDone();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Submit Documents"
      lead={`${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitForReview.busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={submitForReview.busy}
            disabled={alreadyUnderReview}
          >
            Submit for Approval
          </Button>
        </>
      }
    >
      <div className="stack">
        {submitForReview.error ? <Alert tone="error">{submitForReview.error.message}</Alert> : null}
        {alreadyUnderReview ? (
          <Alert tone="info">This vehicle is already with your administrator for review.</Alert>
        ) : (
          <Alert tone="warning">
            Sending documents puts this vehicle back under review, so it cannot be used for new rides until
            it is approved again.
          </Alert>
        )}
        <Textarea
          label="Document reference"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Insurance policy 4482910, valid to March 2027"
        />
      </div>
    </Modal>
  );
}
