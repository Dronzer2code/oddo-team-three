import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AUDIT_ACTION_LABEL,
  VEHICLE_STATUS,
  VEHICLE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatNumber,
} from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DetailList,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  PageHeader,
  Plate,
  Select,
  Skeleton,
  Stat,
  Textarea,
  VehicleStatusBadge,
  resolveErrorCopy,
  useToast,
  vehicleImage,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

export function VehicleDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const vehicle = useApi(() => api.admin.vehicles.get(id), [id]);
  const audit = useApi(() => api.admin.vehicles.auditLogs(id), [id]);

  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>(VEHICLE_STATUS.ACTIVE);
  const [reason, setReason] = useState('');

  const setStatus = useMutation((body: { status: string; reason?: string }) =>
    api.admin.vehicles.setStatus(id, body),
  );

  if (vehicle.error) {
    return (
      <>
        <PageHeader title="Vehicle" />
        <Card>
          <ErrorState {...resolveErrorCopy(vehicle.error)} onRetry={vehicle.reload} />
        </Card>
      </>
    );
  }

  if (vehicle.initialLoading || !vehicle.data) {
    return (
      <>
        <PageHeader title="Vehicle" />
        <div className="grid grid-2">
          <Skeleton variant="block" height={220} />
          <Skeleton variant="block" height={220} />
        </div>
      </>
    );
  }

  const data = vehicle.data;

  const statusOptions = [
    { value: VEHICLE_STATUS.ACTIVE, label: 'Active — usable for new rides' },
    { value: VEHICLE_STATUS.UNDER_REVIEW, label: 'Under review — cannot be used yet' },
    { value: VEHICLE_STATUS.INACTIVE, label: 'Inactive — retired from service' },
  ].filter((option) => option.value !== data.status);

  async function applyStatus() {
    const result = await setStatus.run({ status: nextStatus, reason: reason.trim() || undefined });
    if (result) {
      toast.success('Vehicle status updated');
      setStatusOpen(false);
      setReason('');
      vehicle.reload();
      audit.reload();
    }
  }

  return (
    <>
      <PageHeader
        title={`${data.make} ${data.model}`}
        lead={`Owned by ${data.ownerName}`}
        breadcrumbs={[{ label: 'Vehicles', href: '/vehicles' }, { label: `${data.make} ${data.model}` }]}
        renderLink={(crumb) => <Link to={crumb.href!}>{crumb.label}</Link>}
        actions={
          <>
            <Link className="btn btn-secondary" to={`/employees/${data.ownerId}`}>
              <Icon name="user" size={16} />
              Open driver
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setNextStatus(statusOptions[0]?.value ?? VEHICLE_STATUS.ACTIVE);
                setStatusOpen(true);
              }}
            >
              Change status
            </Button>
          </>
        }
      />

      <div className="grid grid-2" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'start' }}>
        <Card>
          <div className="vehicle-card__media" style={{ borderRadius: 'var(--radius) var(--radius) 0 0' }}>
            <img src={vehicleImage(data.vehicleType)} alt={`${data.make} ${data.model}`} />
            <span className="vehicle-card__status">
              <VehicleStatusBadge status={data.status} />
            </span>
          </div>
          <CardBody className="stack">
            <div className="row-between">
              <div>
                <h2 className="t-title">
                  {data.make} {data.model}
                </h2>
                <p className="t-caption">{VEHICLE_TYPE_LABEL[data.vehicleType]}</p>
              </div>
              <Plate>{data.registrationNumber}</Plate>
            </div>
            <div className="road-rule" />
            <DetailList
              items={[
                { label: 'Owner', value: data.ownerName },
                { label: 'Capacity', value: `${data.seatingCapacity} seats` },
                { label: 'Colour', value: data.color ?? '—' },
                { label: 'Registered', value: formatDate(data.createdAt) },
              ]}
            />
          </CardBody>
        </Card>

        <div className="stack-lg">
          <div className="grid grid-2">
            <Stat label="Rides published" value={formatNumber(data.ridesPublished)} icon="list" small />
            <Stat label="Trips completed" value={formatNumber(data.tripsCompleted)} icon="route" small accent />
            <Stat label="Distance" value={formatDistance(data.totalDistanceKm)} icon="trend" small />
            <Stat label="Transportation cost" value={formatMoney(data.totalCost)} icon="wallet" small />
          </div>

          {data.status === VEHICLE_STATUS.UNDER_REVIEW ? (
            <Alert tone="warning">
              This vehicle is awaiting approval and cannot be selected for new rides. Approving it makes it
              immediately usable by {data.ownerName}.
            </Alert>
          ) : data.status === VEHICLE_STATUS.INACTIVE ? (
            <Alert tone="info">
              This vehicle is retired. Its completed trips and cost history are preserved and still appear in
              reports.
            </Alert>
          ) : null}

          <Card>
            <CardHeader title="Vehicle audit history" />
            <CardBody flush>
              {audit.error ? (
                <ErrorState {...resolveErrorCopy(audit.error)} onRetry={audit.reload} />
              ) : audit.initialLoading ? (
                <div className="card-body stack">
                  <Skeleton width="70%" />
                  <Skeleton width="50%" />
                </div>
              ) : (audit.data ?? []).length === 0 ? (
                <EmptyState icon="history" title="No changes recorded" />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <tbody>
                      {(audit.data ?? []).map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="t-medium">{AUDIT_ACTION_LABEL[entry.action] ?? entry.action}</div>
                            <div className="t-caption">
                              {entry.actorName} · {formatDateTime(entry.createdAt)}
                            </div>
                          </td>
                          <td className="t-caption t-right">
                            {entry.previousValues?.status ? `${entry.previousValues.status} → ` : ''}
                            <span className="t-medium">{String(entry.newValues?.status ?? '')}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Change vehicle status"
        lead={`${data.make} ${data.model} · ${data.registrationNumber}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)} disabled={setStatus.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyStatus} loading={setStatus.busy}>
              Apply status
            </Button>
          </>
        }
      >
        <div className="stack">
          {setStatus.error ? <Alert tone="error">{setStatus.error.message}</Alert> : null}
          <Select
            label="New status"
            options={statusOptions}
            value={nextStatus}
            onChange={(event) => setNextStatus(event.target.value)}
          />
          <Textarea
            label="Reason"
            optional
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Documents verified"
          />
          {nextStatus === VEHICLE_STATUS.INACTIVE ? (
            <Alert tone="warning">
              Retiring the vehicle stops new rides immediately. Existing history is never removed.
            </Alert>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
