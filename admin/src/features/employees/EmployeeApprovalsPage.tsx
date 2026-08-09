import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime, formatRelative, type EmployeeApproval } from '@carpool/shared';
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
  SkeletonCards,
  Textarea,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

type Decision = 'approve' | 'reject';

/**
 * The employee work queue: registrations waiting to be let into the
 * organization. Approving is what moves an account to ACTIVE, which is what
 * grants the passenger panel — so every row here is a real access decision and
 * every decision writes an audit record.
 */
export function EmployeeApprovalsPage() {
  const toast = useToast();
  const approvals = useApi(() => api.admin.employeeApprovals.list(), []);
  const [target, setTarget] = useState<{ employee: EmployeeApproval; decision: Decision } | null>(null);

  const items = approvals.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Employee Approvals"
        lead="Review employee registration, then approve, reject, or request more information."
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
            icon="shield"
            title="No employees waiting for approval"
            text="Registrations appear here the moment somebody signs up against your organization."
            action={
              <Link className="btn btn-secondary" to="/admin/employees">
                View all employees
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-auto">
          {items.map((employee) => (
            <Card key={employee.id}>
              <CardHeader
                title={<Identity name={employee.name} meta={employee.email} />}
                actions={<Badge tone="warning">Pending</Badge>}
              />
              <CardBody className="stack">
                <dl className="detail-list">
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Employee ID</dt>
                    <dd className="detail-list__value">{employee.employeeCode ?? 'Not provided'}</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Department</dt>
                    <dd className="detail-list__value">{employee.department ?? 'Not provided'}</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Phone</dt>
                    <dd className="detail-list__value">{employee.phone ?? 'Not provided'}</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Vehicles registered</dt>
                    <dd className="detail-list__value">{employee.vehicleCount}</dd>
                  </div>
                  <div className="detail-list__item">
                    <dt className="detail-list__label">Requested</dt>
                    <dd className="detail-list__value">
                      {formatDateTime(employee.requestedAt)}
                      <span className="t-caption"> · {formatRelative(employee.requestedAt)}</span>
                    </dd>
                  </div>
                </dl>

                <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon="check"
                    onClick={() => setTarget({ employee, decision: 'approve' })}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    icon="x"
                    onClick={() => setTarget({ employee, decision: 'reject' })}
                  >
                    Reject
                  </Button>
                  <Link className="btn btn-secondary btn-sm" to={`/admin/employees/${employee.id}`}>
                    View Details
                    <Icon name="arrowRight" size={14} />
                  </Link>
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
  target: { employee: EmployeeApproval; decision: Decision } | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useMutation((id: string, decision: Decision, note?: string) =>
    decision === 'approve'
      ? api.admin.employeeApprovals.approve(id, note)
      : api.admin.employeeApprovals.reject(id, note),
  );

  if (!target) return null;
  const { employee, decision } = target;
  const approving = decision === 'approve';

  async function confirm() {
    const result = await mutation.run(employee.id, decision, reason.trim() || undefined);
    if (result) {
      setReason('');
      onDone(approving ? `${employee.name} approved` : `${employee.name} rejected`);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={approving ? `Approve ${employee.name}` : `Reject ${employee.name}`}
      lead={
        approving
          ? 'Their account becomes active and they can start booking rides immediately.'
          : 'Their account is deactivated. They will not be able to sign in.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Cancel
          </Button>
          <Button
            variant={approving ? 'primary' : 'danger'}
            onClick={confirm}
            loading={mutation.busy}
          >
            {approving ? 'Approve Employee' : 'Reject Employee'}
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <Textarea
          label="Reason"
          optional
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={approving ? 'Verified against the HR roster' : 'Employee ID could not be verified'}
        />
        <Alert tone="info">This decision is recorded in the audit log.</Alert>
      </div>
    </Modal>
  );
}
