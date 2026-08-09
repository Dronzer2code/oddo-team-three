import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  VEHICLE_TYPE_LABEL,
  formatDateTime,
  formatPlate,
  formatRelative,
  type VehicleApproval,
} from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  Identity,
  Modal,
  PageHeader,
  Plate,
  SkeletonCards,
  Textarea,
  resolveErrorCopy,
  useToast,
  vehicleImage,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

type Decision = 'approve' | 'reject' | 'documents';

/**
 * The vehicle work queue. Approving is the single action that unlocks the
 * driver context for an employee — only an approved active vehicle may be used
 * to publish a ride — so the decision is confirmed and audited.
 */
export function VehicleApprovalsPage() {
  const toast = useToast();
  const approvals = useApi(() => api.admin.vehicleApprovals.list(), []);
  const [target, setTarget] = useState<{ vehicle: VehicleApproval; decision: Decision } | null>(null);

  const items = approvals.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Vehicle Approvals"
        lead="Vehicles submitted by employees. Approving one lets that employee publish rides."
        actions={
          <Button variant="secondary" icon="refresh" onClick={approvals.reload} loading={approvals.loading}>
            Refresh
          </Button>
        }
      />

      {approvals.error ? (
        <Card>
          <ErrorState {...resolveErrorCopy(approvals.error)} onRetry={approvals.reload} />
        </Card>
      ) : approvals.initialLoading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon="car"
            title="No vehicles waiting for review"
            text="A vehicle appears here as soon as an employee submits it for approval."
            action={
              <Link className="btn btn-secondary" to="/admin/vehicles">
                View all vehicles
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-auto">
          {items.map((vehicle) => (
            <Card key={vehicle.id}>
              <CardHeader
                title={`${vehicle.make} ${vehicle.model}`}
                lead={VEHICLE_TYPE_LABEL[vehicle.vehicleType]}
                actions={<Badge tone="warning">Pending</Badge>}
              />
              <CardBody className="stack">
                <img
                  src={vehicleImage(vehicle.vehicleType)}
                  alt=""
                  style={{ width: '100%', maxWidth: 220, alignSelf: 'center' }}
                />

                <dl className="detail-list">
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Employee</dt>
                    <dd className="detail-list__value">
                      <Identity
                        name={vehicle.ownerName}
                        meta={vehicle.ownerEmployeeCode ?? vehicle.ownerEmail}
                        size="sm"
                      />
                    </dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Vehicle</dt>
                    <dd className="detail-list__value">
                      {vehicle.make} {vehicle.model}
                    </dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Registration</dt>
                    <dd className="detail-list__value">
                      <Plate>{formatPlate(vehicle.registrationNumber)}</Plate>
                    </dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Capacity</dt>
                    <dd className="detail-list__value">{vehicle.seatingCapacity}</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Status</dt>
                    <dd className="detail-list__value">Pending</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Submitted</dt>
                    <dd className="detail-list__value">
                      {formatDateTime(vehicle.submittedAt)}
                      <span className="t-caption"> · {formatRelative(vehicle.submittedAt)}</span>
                    </dd>
                  </div>
                </dl>

                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Link className="btn btn-secondary btn-sm" to={`/admin/vehicles/${vehicle.id}`}>
                    View Details
                    <Icon name="arrowRight" size={14} />
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => setTarget({ vehicle, decision: 'approve' })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    icon="x"
                    onClick={() => setTarget({ vehicle, decision: 'reject' })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="mail"
                    onClick={() => setTarget({ vehicle, decision: 'documents' })}
                  >
                    Request Documents
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <DecisionDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={(message) => {
          setTarget(null);
          toast.success(message);
          approvals.reload();
        }}
      />
    </>
  );
}

function DecisionDialog({
  target,
  onClose,
  onDone,
}: {
  target: { vehicle: VehicleApproval; decision: Decision } | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useMutation((id: string, decision: Decision, note?: string) =>
    decision === 'approve'
      ? api.admin.vehicleApprovals.approve(id, note)
      : api.admin.vehicleApprovals.reject(id, note),
  );

  if (!target) return null;
  const { vehicle, decision } = target;
  const label = `${vehicle.make} ${vehicle.model} · ${formatPlate(vehicle.registrationNumber)}`;

  /* "Request documents" is a rejection with a documented cause — the vehicle
     leaves the queue so it is not decided twice, and the reason tells the
     employee what to resubmit. */
  const title =
    decision === 'approve'
      ? `Approve ${label}`
      : decision === 'reject'
        ? `Reject ${label}`
        : `Request documents for ${label}`;

  const lead =
    decision === 'approve'
      ? 'The vehicle becomes active and the owner can publish rides with it.'
      : decision === 'reject'
        ? 'The vehicle is marked inactive and cannot be used for rides.'
        : 'The vehicle is held as inactive until the owner resubmits it with the documents you ask for.';

  async function confirm() {
    if (decision !== 'approve' && !reason.trim() && decision === 'documents') {
      return;
    }
    const result = await mutation.run(vehicle.id, decision, reason.trim() || undefined);
    if (result) {
      setReason('');
      onDone(
        decision === 'approve'
          ? 'Vehicle approved'
          : decision === 'reject'
            ? 'Vehicle rejected'
            : 'Documents requested',
      );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      lead={lead}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Cancel
          </Button>
          <Button
            variant={decision === 'approve' ? 'primary' : 'danger'}
            onClick={confirm}
            loading={mutation.busy}
            disabled={decision === 'documents' && !reason.trim()}
          >
            {decision === 'approve' ? 'Approve Vehicle' : decision === 'reject' ? 'Reject Vehicle' : 'Send Request'}
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <Textarea
          label={decision === 'documents' ? 'What is missing' : 'Reason'}
          optional={decision !== 'documents'}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            decision === 'approve'
              ? 'Registration verified against the RC book'
              : 'Insurance certificate is expired — please upload a current one'
          }
        />
        <Alert tone="info">This decision is recorded in the audit log.</Alert>
      </div>
    </Modal>
  );
}
