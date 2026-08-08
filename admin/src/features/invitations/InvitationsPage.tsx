import { useState } from 'react';
import { INVITATION_STATUS, formatDate, formatRelative, type Invitation } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SkeletonTable,
  Textarea,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';

const STATUS_TONE = {
  pending: 'warning',
  accepted: 'success',
  canceled: 'neutral',
  expired: 'danger',
} as const;

export function InvitationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null);
  const [form, setForm] = useState({ name: '', email: '', employeeCode: '', department: '' });
  const [bulkText, setBulkText] = useState('');

  const invitations = useApi(() => api.admin.invitations.list({ page, pageSize: 10 }), [page]);

  const create = useMutation(
    (body: { name: string; email: string; employeeCode?: string; department?: string }) =>
      api.admin.invitations.create(body),
  );
  const bulk = useMutation((rows: Array<{ email: string; name: string; department?: string }>) =>
    api.admin.invitations.bulk(rows),
  );
  const resend = useMutation((id: string) => api.admin.invitations.resend(id));
  const cancel = useMutation((id: string) => api.admin.invitations.cancel(id));

  const items = invitations.data?.items ?? [];
  const pagination = invitations.data?.pagination;

  async function submitInvite() {
    const result = await create.run({
      name: form.name.trim(),
      email: form.email.trim(),
      employeeCode: form.employeeCode.trim() || undefined,
      department: form.department.trim() || undefined,
    });
    if (result) {
      toast.success(`Invitation created for ${result.email}`);
      setInviteOpen(false);
      setForm({ name: '', email: '', employeeCode: '', department: '' });
      invitations.reload();
    }
  }

  async function submitBulk() {
    // "Name, email, department" — one employee per line.
    const rows = bulkText
      .split('\n')
      .map((line) => line.split(',').map((cell) => cell.trim()))
      .filter((cells) => cells.length >= 2 && cells[0] && cells[1])
      .map((cells) => ({ name: cells[0]!, email: cells[1]!, department: cells[2] || undefined }));

    if (rows.length === 0) {
      toast.error('Add at least one line as: name, email, department');
      return;
    }

    const result = await bulk.run(rows);
    if (result) {
      toast.success(`${result.invited} invitation(s) created, ${result.failed} skipped`);
      setBulkOpen(false);
      setBulkText('');
      invitations.reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Invitations"
        lead="Onboarding is organization-controlled: invited employees are activated the moment they accept."
        actions={
          <>
            <Button variant="secondary" icon="upload" onClick={() => setBulkOpen(true)}>
              Import list
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>
              Invite employee
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader title="All invitations" lead="Pending invitations appear first" />
        <CardBody flush>
          {invitations.error ? (
            <ErrorState {...resolveErrorCopy(invitations.error)} onRetry={invitations.reload} />
          ) : invitations.initialLoading ? (
            <SkeletonTable rows={6} columns={5} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="mail"
              title="No invitations yet"
              text="Invite your first employees, or share the organization code so they can register themselves."
              action={
                <Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>
                  Invite employee
                </Button>
              }
            />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invitee</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>
                          <div className="t-medium">{invitation.name}</div>
                          <div className="t-caption">{invitation.email}</div>
                        </td>
                        <td className="t-caption">{invitation.department ?? '—'}</td>
                        <td>
                          <Badge tone={STATUS_TONE[invitation.status]}>
                            {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="t-caption t-nowrap">
                          {formatDate(invitation.expiresAt)}
                          <div className="t-muted" style={{ fontSize: 11 }}>
                            invited {formatRelative(invitation.createdAt)}
                          </div>
                        </td>
                        <td>
                          <div className="table__actions">
                            {invitation.status === INVITATION_STATUS.PENDING ? (
                              <IconButton
                                icon="copy"
                                label="Copy invitation link"
                                size="sm"
                                onClick={() => {
                                  void navigator.clipboard.writeText(invitation.link);
                                  toast.info('Invitation link copied');
                                }}
                              />
                            ) : null}
                            {invitation.status !== INVITATION_STATUS.ACCEPTED ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={resend.busy}
                                onClick={async () => {
                                  const result = await resend.run(invitation.id);
                                  if (result) {
                                    toast.success('Invitation resent with a fresh link');
                                    invitations.reload();
                                  } else if (resend.error) {
                                    toast.error(resend.error.message);
                                  }
                                }}
                              >
                                Resend
                              </Button>
                            ) : null}
                            {invitation.status === INVITATION_STATUS.PENDING ? (
                              <Button variant="ghost" size="sm" onClick={() => setCancelTarget(invitation)}>
                                Cancel
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
                  label="invitations"
                />
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite an employee"
        lead="They will receive a single-use link that activates their account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={create.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitInvite} loading={create.busy}>
              Create invitation
            </Button>
          </>
        }
      >
        <div className="stack">
          {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
          <Input
            label="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={create.error?.fieldErrors.name}
            autoFocus
          />
          <Input
            label="Work email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            error={create.error?.fieldErrors.email}
          />
          <div className="form-row">
            <Input
              label="Employee ID"
              optional
              value={form.employeeCode}
              onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
              error={create.error?.fieldErrors.employeeCode}
            />
            <Input
              label="Department"
              optional
              value={form.department}
              onChange={(event) => setForm({ ...form, department: event.target.value })}
              error={create.error?.fieldErrors.department}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Import several employees"
        lead="One employee per line: name, email, department."
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)} disabled={bulk.busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitBulk} loading={bulk.busy}>
              Create invitations
            </Button>
          </>
        }
      >
        <div className="stack">
          {bulk.error ? <Alert tone="error">{bulk.error.message}</Alert> : null}
          <Textarea
            label="Employees"
            rows={7}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={
              'Nikhil Varma, nikhil.varma@example.com, Finance\nAisha Khan, aisha.khan@example.com, Design'
            }
          />
          <Alert tone="info">
            Rows that already have an account or a pending invitation are skipped — the rest still go out.
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel this invitation?"
        message={`${cancelTarget?.name ?? ''} will no longer be able to use their link. You can invite them again later.`}
        confirmLabel="Cancel invitation"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancel.busy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          const result = await cancel.run(cancelTarget.id);
          if (result) {
            toast.success('Invitation canceled');
            setCancelTarget(null);
            invitations.reload();
          } else if (cancel.error) {
            toast.error(cancel.error.message);
          }
        }}
      />
    </>
  );
}
