import { useEffect, useState } from 'react';
import { ACCOUNT_STATUS, type AccountStatus } from '@carpool/shared';
import { Alert, Button, Modal, Select, Textarea, useToast } from '@carpool/ui';
import { api } from '../../lib/api';
import { useMutation } from '../../lib/hooks';

export interface StatusTarget {
  id: string;
  name: string;
  status: AccountStatus;
}

/**
 * Access changes are confirmed explicitly and always offer a reason, which is
 * stored on the audit record.
 */
export function EmployeeStatusDialog({
  target,
  onClose,
  onDone,
}: {
  target: StatusTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<string>('');
  const [reason, setReason] = useState('');

  const mutation = useMutation((id: string, body: { status: string; reason?: string }) =>
    api.admin.employees.setStatus(id, body),
  );

  useEffect(() => {
    if (!target) return;
    const next =
      target.status === ACCOUNT_STATUS.ACTIVE ? ACCOUNT_STATUS.SUSPENDED : ACCOUNT_STATUS.ACTIVE;
    setStatus(next);
    setReason('');
  }, [target]);

  if (!target) return null;
  const employee = target;

  const options = [
    { value: ACCOUNT_STATUS.ACTIVE, label: employee.status === ACCOUNT_STATUS.SUSPENDED ? 'Reactivate access' : 'Activate access' },
    { value: ACCOUNT_STATUS.SUSPENDED, label: 'Suspend access' },
    { value: ACCOUNT_STATUS.DEACTIVATED, label: 'Deactivate account' },
  ].filter((option) => option.value !== target.status);

  const consequence =
    status === ACCOUNT_STATUS.SUSPENDED
      ? 'They will keep their history but cannot publish or request rides until reactivated.'
      : status === ACCOUNT_STATUS.DEACTIVATED
        ? 'They will not be able to sign in. Their rides, trips and payments are preserved.'
        : 'They will be able to publish and request rides again immediately.';

  async function confirm() {
    const result = await mutation.run(employee.id, { status, reason: reason.trim() || undefined });
    if (result) {
      toast.success(`${employee.name}: access ${status === ACCOUNT_STATUS.ACTIVE ? 'restored' : status}`);
      onDone();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Change access for ${employee.name}`}
      lead={`Currently ${employee.status}. This action is recorded in the audit log.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.busy}>
            Cancel
          </Button>
          <Button
            variant={status === ACCOUNT_STATUS.ACTIVE ? 'primary' : 'danger'}
            onClick={confirm}
            loading={mutation.busy}
          >
            Confirm change
          </Button>
        </>
      }
    >
      <div className="stack">
        {mutation.error ? <Alert tone="error">{mutation.error.message}</Alert> : null}
        <Select
          label="New status"
          options={options}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
        <Textarea
          label="Reason"
          optional
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Vehicle documents pending verification"
        />
        <Alert tone={status === ACCOUNT_STATUS.ACTIVE ? 'info' : 'warning'}>{consequence}</Alert>
      </div>
    </Modal>
  );
}
